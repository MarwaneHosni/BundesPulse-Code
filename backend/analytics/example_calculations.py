"""Run representative analytical calculations against the real snapshot.

Demonstrates the core measures in ``backend/analytics/measures.py`` using the
prepared DuckDB snapshot:

* population growth (percentage change), Bayern 2023 -> 2024
* ranking + percentile of Bundesländer by GDP per capita 2024
* charging points per 10,000 inhabitants (per-capita normalisation)
* region (Kreis) vs its Bundesland benchmark (charging points)
* correlation: per-Land population growth vs GDP per capita 2024
* anomaly detection: Germany's GDP change in 2020 (COVID) among all years

Run with ``python -m backend.analytics.example_calculations`` after building
the snapshot (``npm run data:build``).
"""

from __future__ import annotations

import sys

from backend.analytics.measures import (
    compare_to_benchmark,
    correlation,
    detect_anomaly,
    per_capita,
    percentage_change,
    percentile,
    rank,
    yoy_changes,
)
from backend.db import SnapshotUnavailableError, get_connection, select_rows


def _fmt(number, digits: int = 2) -> str:
    if number is None:
        return "-"
    return f"{number:,.{digits}f}"


def _values(
    conn, slug: str, year: int | None = None, level: str | None = None
) -> list[tuple[str, float]]:
    """Return [(region_id, value)] for an indicator (optionally filtered)."""
    sql = (
        "SELECT o.region_id, o.value FROM observations o "
        "JOIN indicators i ON i.indicator_id = o.indicator_id "
        "JOIN regions r ON r.region_id = o.region_id WHERE i.slug = ?"
    )
    params: list = [slug]
    if year is not None:
        sql += " AND o.period = ?"
        params.append(year)
    if level is not None:
        sql += " AND r.type = ?"
        params.append(level)
    rows = select_rows(conn, sql, params)
    return [(str(r["region_id"]), float(r["value"])) for r in rows]


def _single(conn, slug: str, region_id: str, year: int) -> float | None:
    rows = _values(conn, slug, year=year)
    m = {rid: v for rid, v in rows}
    return m.get(region_id)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    try:
        conn = get_connection()
    except SnapshotUnavailableError as err:
        print(f"snapshot not available: {err}")
        return

    print("=== 1) Percentage change: population growth, Bayern 2023 -> 2024 ===")
    pop_2023 = _single(conn, "pop_total", "09", 2023)
    pop_2024 = _single(conn, "pop_total", "09", 2024)
    print(f"  Bayern pop_total 2023={_fmt(pop_2023)}, 2024={_fmt(pop_2024)}")
    print(
        f"  growth = {_fmt(percentage_change(pop_2024, pop_2023))} %  "
        f"(official pop_growth 2024: {_fmt(_single(conn, 'pop_growth', '09', 2024))} %)"
    )

    print("\n=== 2) Ranking + percentile: GDP je Einwohner 2024, Bundesländer ===")
    gdp = [v for _, v in _values(conn, "gdp_pc", year=2024, level="bundesland")]
    names = {
        r["region_id"]: r["name"]
        for r in select_rows(conn, "SELECT region_id, name FROM regions WHERE type='bundesland'")
    }
    by_name = {
        name: v
        for rid, v in _values(conn, "gdp_pc", year=2024, level="bundesland")
        for name in [names[rid]]
    }
    for land in ("Hamburg", "Bayern", "Thüringen"):
        v = by_name[land]
        print(
            f"  {land:<16} gdp_pc={_fmt(v)}  rank={rank(v, gdp, order='desc')}/16  "
            f"percentile={_fmt(percentile(v, gdp), 1)}"
        )
    de_gdp_pc = _single(conn, "gdp_pc", "DE", 2024)
    bay = compare_to_benchmark(by_name["Bayern"], de_gdp_pc)
    print(
        f"  Bayern vs Germany (gdp_pc 2024): diff={_fmt(bay['diff'])} EUR, "
        f"ratio={_fmt(bay['ratio'])}"
    )

    print("\n=== 3) Per-10,000 normalisation: charging points Bayern ===")
    chargers = _single(conn, "chargers", "09", 2026)
    computed = per_capita(chargers, pop_2024, per=10_000)
    stored = _single(conn, "chargers_per_10k", "09", 2026)
    print(f"  chargers={_fmt(chargers, 0)} | pop 2024={_fmt(pop_2024, 0)}")
    match = abs(computed - stored) < 0.01 if computed is not None and stored is not None else False
    print(f"  computed per 10,000 = {_fmt(computed)} | stored = {_fmt(stored)}  (match: {match})")

    print("\n=== 4) Region vs Bundesland: Landkreis München vs Bayern (charging points, 2026) ===")
    muenchen = _single(conn, "chargers", "09184", 2026)
    compare = compare_to_benchmark(muenchen, chargers)
    print(f"  Landkreis München={_fmt(muenchen, 0)}, Bayern={_fmt(chargers, 0)}")
    if compare["ratio"] is not None:
        print(
            f"  share of Land = {_fmt(compare['ratio'] * 100, 2)} %  "
            f"(diff % of Bayern benchmark: {_fmt(compare['diff_percent'])} %)"
        )

    print("\n=== 5) Correlation: pop_growth vs gdp_pc (2024, 16 Bundesländer) ===")
    x = [v for _, v in _values(conn, "pop_growth", year=2024, level="bundesland")]
    y = [v for _, v in _values(conn, "gdp_pc", year=2024, level="bundesland")]
    print(f"  Pearson r = {correlation(x, y)['coefficient']}  (n={len(x)})")

    print("\n=== 6) Anomaly detection: Germany annual population growth, 1991-2024 ===")
    series = select_rows(
        conn,
        "SELECT o.period, o.value FROM observations o "
        "JOIN indicators i ON i.indicator_id = o.indicator_id "
        "WHERE i.slug = 'pop_total' AND o.region_id = 'DE' ORDER BY o.period",
    )
    series = [(int(r["period"]), float(r["value"])) for r in series]
    changes = [
        (row["period"], row["percentage_change"])
        for row in yoy_changes(series)
        if row["percentage_change"] is not None
    ]
    mean = sum(c for _, c in changes) / len(changes)
    print(f"  annual changes (n={len(changes)}), mean={_fmt(mean)} %")
    for year, change in changes:
        res = detect_anomaly(change, [c for y_, c in changes if y_ != year], threshold=2.0)
        if res["is_anomaly"]:
            z = _fmt(res["z_score"], 2)
            print(f"  ANOMALY {year}: population change {_fmt(change)} % (z = {z})")

    conn.close()


if __name__ == "__main__":
    main()
