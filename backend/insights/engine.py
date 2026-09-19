"""Rule-based analytical explanation layer for region profiles.

Generates short, human-readable statements *from the snapshot data only* —
no LLM, no fabricated numbers, no causal claims. Each statement is traceable
to (indicator, period, value, formula) and only fires when the underlying
observations actually exist.

The rule set is deliberately small (a curated handful of rules) so the output
stays useful, predictable and easy to audit.
"""

from __future__ import annotations

from backend.db import select_rows

MAX_STATEMENTS = 6


# ---------------------------------------------------------------- formatting


def _fmt(value: float | None, digits: int = 1) -> str:
    """German number formatting: 1234567.8 -> '1.234.567,8'."""
    if value is None:
        return "–"
    s = f"{value:,.{digits}f}"
    return s.replace(",", "\u00a7").replace(".", ",").replace("\u00a7", ".")


def _signed(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "–"
    return f"{'+' if value > 0 else ''}{_fmt(value, digits)}"


def _rows(conn, sql: str, params: list) -> list[dict]:
    return select_rows(conn, sql, params)


# ---------------------------------------------------------------- data loading


def _insights_by_slug(rows: list[dict]) -> dict[str, dict]:
    return {r["slug"]: r for r in rows}


def _region_insights(conn, region_id: str) -> list[dict]:
    return _rows(
        conn,
        """
        SELECT i.slug, i.name, i.category, i.unit,
               n.period, n.value, n.previous_value, n.previous_period,
               n.yoy_pct, n.rank_desc, n.rank_asc, n.percentile,
               n.vs_de_ratio, n.vs_land_ratio
        FROM insights n
        JOIN indicators i ON i.indicator_id = n.indicator_id
        WHERE n.region_id = ?
        """,
        [region_id],
    )


def _region_trends(conn, region_id: str) -> dict[str, dict]:
    rows = _rows(
        conn,
        """
        SELECT i.slug, i.name, i.unit,
               t.first_period, t.latest_period, t.first_value, t.latest_value,
               t.total_change_pct, t.avg_annual_change_pct, t.n_periods
        FROM trends t
        JOIN indicators i ON i.indicator_id = t.indicator_id
        WHERE t.region_id = ?
        """,
        [region_id],
    )
    return {r["slug"]: r for r in rows}


def _rank_history(conn, region_id: str) -> list[dict]:
    """Latest rank vs the previous ranked period, per indicator."""
    rows = _rows(
        conn,
        "SELECT indicator_id, period, rank_desc, level FROM rankings "
        "WHERE region_id = ? ORDER BY indicator_id, period",
        [region_id],
    )
    per: dict[int, list[dict]] = {}
    for r in rows:
        per.setdefault(r["indicator_id"], []).append(r)
    moves: list[dict] = []
    for _ind_id, entries in per.items():
        if len(entries) < 2:
            continue
        now, prev = entries[-1], entries[-2]
        moves.append(
            {
                "indicator_id": now["indicator_id"],
                "level": now["level"],
                "now_period": now["period"],
                "now_rank": now["rank_desc"],
                "prev_period": prev["period"],
                "prev_rank": prev["rank_desc"],
            }
        )
    return moves


def _slug_by_id(conn) -> dict[int, str]:
    return {
        r["indicator_id"]: r["slug"]
        for r in _rows(conn, "SELECT indicator_id, slug FROM indicators", [])
    }


def _peers_at_level(conn) -> dict[str, int]:
    out: dict[str, int] = {}
    rows = _rows(
        conn,
        "SELECT type, count(*) AS n FROM regions WHERE type != 'bund' GROUP BY type",
        [],
    )
    for r in rows:
        out[r["type"]] = int(r["n"])
    return out


# ---------------------------------------------------------------- build


def build_narratives(conn, region: dict) -> list[dict]:
    """Return ordered narrative statements for a region.

    ``region`` is a dict with at least: region_id, name, type.
    """
    region_id, rtype = region["region_id"], region["type"]
    insights = _insights_by_slug(_region_insights(conn, region_id))
    de = _insights_by_slug(_region_insights(conn, "DE"))
    trends = _region_trends(conn, region_id)
    moves = _rank_history(conn, region_id)
    slugs = _slug_by_id(conn)
    peers = _peers_at_level(conn)

    statements: list[dict] = []
    if rtype == "bund":
        _rules_bund(statements, insights, trends, region["name"])
    elif rtype == "bundesland":
        _rules_bundesland(statements, insights, de, trends, moves, slugs, peers, region["name"])
    elif rtype == "kreis":
        _rules_kreis(statements, insights, peers, region["name"])

    statements.sort(key=lambda s: s["priority"])
    return statements[:MAX_STATEMENTS]


def _emit(statements: list[dict], kind: str, priority: int, text: str) -> None:
    statements.append({"id": kind, "priority": priority, "text": text})


# ---------------------------------------------------------------- Bund


def _rules_bund(statements, insights, trends, name: str) -> None:
    pop = insights.get("pop_total")
    if pop and pop["yoy_pct"] is not None:
        _emit(
            statements,
            "bund_pop",
            1,
            f"Die Bevölkerung Deutschlands wuchs {pop['period']} um {_fmt(pop['yoy_pct'], 2)} % "
            f"auf {_fmt(pop['value'], 0)} Einwohner.",
        )
    gdp = insights.get("gdp_pc")
    if gdp and gdp["yoy_pct"] is not None:
        _emit(
            statements,
            "bund_gdp_growth",
            2,
            f"Das BIP je Einwohner stieg {gdp['period']} um {_signed(gdp['yoy_pct'])} % "
            f"auf {_fmt(gdp['value'], 0)} €.",
        )
    trend = trends.get("gdp_pc")
    if trend and trend["n_periods"] >= 3 and trend["total_change_pct"] is not None:
        _emit(
            statements,
            "bund_gdp_longrun",
            3,
            f"Von {trend['first_period']} bis {trend['latest_period']} wuchs das BIP je "
            f"Einwohner um {_signed(trend['total_change_pct'], 0)} % (im Schnitt "
            f"{_signed(trend['avg_annual_change_pct'], 1)} % pro Jahr).",
        )
    share = insights.get("pop_share_65plus")
    if share and share["value"] is not None:
        _emit(
            statements,
            "bund_elderly",
            4,
            f"Der Anteil der 65-Jährigen und Älteren liegt bei {_fmt(share['value'], 1)} % "
            f"(Stand {share['period']}).",
        )


# ---------------------------------------------------------------- Bundesländer


def _rules_bundesland(statements, insights, de, trends, moves, slugs, peers, name: str) -> None:
    pop = insights.get("pop_total")
    de_pop = de.get("pop_total")

    # 1) population growth vs Germany
    if pop and de_pop and pop["yoy_pct"] is not None and de_pop["yoy_pct"] is not None:
        diff = pop["yoy_pct"] - de_pop["yoy_pct"]
        if abs(diff) >= 0.05:
            _emit(
                statements,
                "pop_us_de",
                1,
                f"Die Bevölkerung wuchs {pop['period']} um {_fmt(pop['yoy_pct'], 2)} % – "
                f"{'schneller' if diff > 0 else 'langsamer'} als im Bund "
                f"({_signed(de_pop['yoy_pct'], 2)} %).",
            )

    # 2) per-capita GDP growth vs Germany
    gdp = insights.get("gdp_pc")
    de_gdp = de.get("gdp_pc")
    if gdp and de_gdp and gdp["yoy_pct"] is not None and de_gdp["yoy_pct"] is not None:
        diff = gdp["yoy_pct"] - de_gdp["yoy_pct"]
        if abs(diff) >= 0.3:
            _emit(
                statements,
                "gdp_us_de",
                2,
                f"Das BIP je Einwohner wuchs {gdp['period']} um {_signed(gdp['yoy_pct'])} % – "
                f"{'stärker' if diff > 0 else 'schwächer'} als im Bund "
                f"({_signed(de_gdp['yoy_pct'])} %).",
            )

    # 3) housing activity vs population (permits/completions share vs population share)
    housing_row = None
    for slug in ("housing_permits", "housing_completions"):
        h = insights.get(slug)
        if h and h["vs_de_ratio"] and pop and pop["vs_de_ratio"]:
            housing_row = h
            break
    if housing_row:
        h = housing_row
        housing_share = h["vs_de_ratio"] * 100
        pop_share = pop["vs_de_ratio"] * 100
        diff = housing_share - pop_share
        label = "Baugenehmigungen" if h["slug"] == "housing_permits" else "Baufertigstellungen"
        if diff >= 1.5:
            _emit(
                statements,
                "housing_pop",
                3,
                f"Der Wohnungsbau läuft der Bevölkerung voraus: auf {name} entfallen "
                f"{_fmt(housing_share, 1)} % der deutschen {label}, aber nur "
                f"{_fmt(pop_share, 1)} % der Bevölkerung ({h['period']}).",
            )
        elif diff <= -1.5:
            _emit(
                statements,
                "housing_pop",
                3,
                f"Der Wohnungsbau hinkt der Bevölkerung hinterher: "
                f"{_fmt(housing_share, 1)} % der deutschen {label}, "
                f"aber {_fmt(pop_share, 1)} % der Bevölkerung ({h['period']}).",
            )

    # 4) charging infrastructure vs Germany + rank
    chargers = insights.get("chargers_per_10k") or insights.get("chargers")
    if chargers and chargers["value"] is not None:
        unit = {"per 10 000": "je 10 000 Einwohner", "points": "Ladepunkte"}.get(
            chargers["unit"] or "", chargers["unit"] or "Ladepunkte"
        )
        ratio = chargers["vs_de_ratio"]
        parts = [f"bei {_fmt(chargers['value'], 1)} {unit}"]
        if ratio is not None and abs(ratio - 1) * 100 >= 5:
            parts.append(
                f"{_fmt((ratio - 1) * 100, 0)} % "
                f"{'über' if ratio > 1 else 'unter'} dem Bundeswert"
            )
        if chargers["rank_desc"] is not None and peers.get("bundesland"):
            parts.append(f"Rang {chargers['rank_desc']} von {peers['bundesland']}")
        _emit(
            statements,
            "infra",
            4,
            f"Die Ladeinfrastruktur liegt {', '.join(parts)} (Stand {chargers['period']}).",
        )

    # 5) elderly share vs Germany
    share = insights.get("pop_share_65plus")
    de_share = de.get("pop_share_65plus")
    if (
        share
        and de_share
        and share["vs_de_ratio"] is not None
        and share["value"] is not None
        and de_share["value"] is not None
    ):
        pct = (share["vs_de_ratio"] - 1) * 100
        if abs(pct) >= 0.5:
            _emit(
                statements,
                "elderly",
                5,
                f"Der Anteil der 65-Jährigen und Älteren liegt bei {_fmt(share['value'], 1)} % – "
                f"{_fmt(abs(pct), 0)} % {'unter' if pct < 0 else 'über'} dem Bundeswert "
                f"({_fmt(de_share['value'], 1)} %).",
            )

    # 6) long-run GDP trend
    trend = trends.get("gdp_pc")
    if trend and trend["n_periods"] >= 3 and trend["total_change_pct"] is not None:
        _emit(
            statements,
            "gdp_longrun",
            6,
            f"Von {trend['first_period']} bis {trend['latest_period']} wuchs das BIP je "
            f"Einwohner um {_signed(trend['total_change_pct'], 0)} % (im Schnitt "
            f"{_signed(trend['avg_annual_change_pct'], 1)} % pro Jahr).",
        )

    # 7) ranking movement (improvements only, clearly above noise)
    move = _significant_move(moves, slugs)
    if move:
        _emit(
            statements,
            "rank_move",
            2,
            f"Im Ranking verbesserte sich {name} bei „{move['slug']}“ um "
            f"{abs(move['delta'])} Plätze – von Rang {move['prev_rank']} "
            f"({move['prev_period']}) auf Rang {move['now_rank']} ({move['now_period']}).",
        )


# ---------------------------------------------------------------- Kreise


def _rules_kreis(statements, insights, peers, name: str) -> None:
    rate = insights.get("unemp_rate")
    n_kreise = peers.get("kreis", 400)

    if rate and rate["value"] is not None:
        text = f"Die Arbeitslosenquote liegt bei {_fmt(rate['value'], 1)} %"
        if rate["rank_desc"] is not None:
            text += (
                f" – Rang {rate['rank_desc']} von {n_kreise} Kreisen "
                f"(niedrigere Quote = besser)"
            )
        _emit(statements, "kreis_unemp", 1, text + f" (Stand {rate['period']}).")

    chargers = insights.get("chargers")
    if chargers and chargers["value"] is not None:
        text = f"{name} verfügt über {_fmt(chargers['value'], 0)} öffentliche Ladepunkte"
        if chargers["rank_desc"] is not None:
            text += f" – Rang {chargers['rank_desc']} von {n_kreise} Kreisen"
        _emit(statements, "kreis_infra", 2, text + f" (Stand {chargers['period']}).")

    unemp = insights.get("unemp")
    if unemp and unemp["value"] is not None and rate and rate["value"] is not None:
        _emit(
            statements,
            "kreis_unemp_count",
            3,
            f"{_fmt(unemp['value'], 0)} Arbeitslose stehen einer Quote von "
            f"{_fmt(rate['value'], 1)} % gegenüber (Stand {unemp['period']}).",
        )


def _significant_move(moves: list[dict], slugs: dict[int, str]) -> dict | None:
    candidates = []
    for m in moves:
        delta = m["now_rank"] - m["prev_rank"]
        threshold = 2 if m["level"] == "bundesland" else 20
        if delta >= 0 or abs(delta) < threshold:
            continue
        candidates.append({**m, "delta": delta, "slug": slugs.get(m["indicator_id"], "Indikator")})
    if not candidates:
        return None
    return max(candidates, key=lambda c: abs(c["delta"]))
