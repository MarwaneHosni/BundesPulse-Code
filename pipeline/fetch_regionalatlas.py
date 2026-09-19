"""Fetch official Regionalatlas / Regionaldatenbank Deutschland data and stage it.

The *Regionalatlas Deutschland* (Statistische Aemter des Bundes und der Laender)
is presented on statistikportal.de and backed by an official, machine-readable
ArcGIS REST service. This fetcher does **not** scrape the visual website; it:

1. downloads the public indicator catalogue (``app/json/services.json``) and the
   thesaurus (``app/csv/thesaurus.csv``);
2. queries the official dynamic-map-layer REST endpoint for a curated set of
   indicator tables (Laender / Kreise, all available years);
3. maps the official region keys (AGS) onto the project's canonical region ids;
4. writes staging CSVs to ``data/processed/regionalatlas/`` for ``build_data``.

Only a curated subset of the 180+ catalogue indicators is imported (see
``TABLE_CATEGORY``) - useful, understandable indicators that broaden the app
without duplicating everything. Nothing here runs at request time.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = Path(os.environ.get("BUNDESPULSE_RA_RAW_DIR", REPO_ROOT / "data" / "raw" / "regionalatlas"))
OUT_DIR = Path(
    os.environ.get(
        "BUNDESPULSE_PROCESSED_DIR", REPO_ROOT / "data" / "processed" / "regionalatlas"
    )
)
PROCESSED_ROOT = REPO_ROOT / "data" / "processed"

SERVICES_URL = "https://regionalatlas.statistikportal.de/app/json/services.json"
THESAURUS_URL = "https://regionalatlas.statistikportal.de/app/csv/thesaurus.csv"
ARCGIS_QUERY = (
    "https://www.gis-idmz.nrw.de/arcgis/rest/services/stba/regionalatlas/MapServer/dynamicLayer/query"
)
SOURCE_URL = "https://regionalatlas.statistikportal.de/"

SOURCE_ID = 1
INDICATOR_ID_BASE = 1000  # dedicated, non-clashing range for Regionalatlas indicators

HEADERS = {"User-Agent": "Mozilla/5.0"}

# Curated selection: table code -> category. Only these tables are imported.
TABLE_CATEGORY: dict[str, str] = {
    # Gebiet und Flaeche
    "AI001-2-5": "Environment",
    # Bevoelkerung
    "AI002-1-5": "Demography",
    "AI002-2-5": "Demography",
    "AI002-3": "Demography",
    "AI002-4-5": "Demography",
    # Bildung
    "AI003-1": "Education",
    "AI003-2": "Education",
    "AI003-3": "Education",
    # Unternehmen
    "AI004-1": "Economy",
    "AI004-2": "Economy",
    # Erwerbstaetigkeit und Arbeitslosigkeit
    "AI007-1": "Labour",
    "AI007-2": "Labour",
    "AI008-1-5": "Labour",
    "AI008-2": "Labour",
    # Landwirtschaft
    "AI009": "Agriculture",
    # Industrie
    "AI010-1": "Industry",
    "AI010-2-5": "Industry",
    # Bauen und Wohnen
    "AI011-5": "Housing",
    # Tourismus
    "AI012-5": "Tourism",
    # Verkehr
    "AI013-1": "Mobility",
    "AI013-2": "Mobility",
    "AI013-3": "Mobility",
    # Gesundheits- und Sozialwesen
    "AI014-1": "Health",
    "AI014-2": "Health",
    # Oeffentliche Haushalte
    "AI015": "Public finance",
    # Verdienste und Einkommen
    "AI016-1": "Income",
    "AI016-2-5": "Income",
    # Umwelt
    "AI019": "Environment",
    "AI019-1-5": "Environment",
    "AI019-2": "Environment",
}

# Regionalatlas codes that are just noise / non-values.
SENTINELS = {6666666666.0, 2222222222.0, 9999999999.0, -9999.0, -99999.0}


# ------------------------------------------------------------------ helpers


def download(url: str, dest: Path) -> Path:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as out:
            out.write(resp.read())
        print(f"  downloaded {dest.name} ({dest.stat().st_size:,} bytes)")
    else:
        print(f"  using cached {dest.name}")
    return dest


def _slugify(text: str) -> str:
    text = text.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        text = text.replace(a, b)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:60]


def _table_name(code: str) -> str:
    return code.lower().replace("-", "_")


def _region_id(ags: str) -> str | None:
    from_ags = ags.strip()
    if from_ags in ("DG", "DE"):
        return "DE"
    if from_ags.isdigit() and len(from_ags) in (2, 5):
        return from_ags
    return None


def _canonical_regions() -> set[str]:
    """Union of region ids already staged by the other fetchers (+ DE)."""
    ids = {"DE"}
    for name in ("destatis", "arbeitsagentur", "netzagentur", "destatis_more"):
        f = PROCESSED_ROOT / name / "regions.csv"
        if not f.exists():
            continue
        with open(f, newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if row.get("region_id"):
                    ids.add(row["region_id"].strip())
    return ids


def _load_catalogue(raw_dir: Path) -> list[dict]:
    doc = json.loads((raw_dir / "services.json").read_text(encoding="utf-8"))
    return doc


def _attr_model(table: dict) -> list[dict]:
    out = []
    for a in table["attributes"]:
        code = str(a["code"]).strip()
        out.append(
            {
                "code": code,
                "col": code.lower(),
                "name": str(a.get("title_short") or a.get("title_long") or code).strip(),
                "unit": str(a.get("unit") or "").strip(),
                "title_long": str(a.get("title_long") or a.get("title_short") or code).strip(),
            }
        )
    return out


def _query(table: str, where: str, out_fields: str) -> list[dict]:
    layer = {
        "id": 0,
        "source": {
            "type": "dataLayer",
            "dataSource": {
                "type": "table",
                "workspaceId": "gdb",
                "dataSourceName": "regionalatlas." + table,
            },
        },
    }
    payload = {
        "f": "json",
        "layer": json.dumps(layer),
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "false",
        "orderByFields": "ags2,jahr2",
        "resultRecordCount": "2000000",
    }
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        ARCGIS_QUERY, data=data, headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded"}
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=240).read().decode("utf-8", "replace"))
    if "error" in resp:
        raise RuntimeError(f"regionalatlas query failed ({table}/{where}): {resp['error']}")
    return resp.get("features", [])


# ------------------------------------------------------------------ main


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date().isoformat()

    print("- Regionalatlas: catalogue + thesaurus")
    download(SERVICES_URL, RAW_DIR / "services.json")
    download(THESAURUS_URL, RAW_DIR / "thesaurus.csv")
    catalogue = _load_catalogue(RAW_DIR)

    tables = {t["code"]: t for theme in catalogue for t in theme["children"]}
    selected = [(code, tables[code]) for code in TABLE_CATEGORY if code in tables]
    print(f"  selected {len(selected)} of {len(tables)} tables")

    # deterministic indicator ids + unique slugs
    indicators: list[tuple] = []
    used_slugs: set[str] = set()
    id_for: dict[tuple[str, str], int] = {}
    next_id = INDICATOR_ID_BASE
    for code, table in sorted(selected, key=lambda x: x[0]):
        category = TABLE_CATEGORY[code]
        for attr in _attr_model(table):
            slug = _slugify(attr["name"])
            if not slug:
                slug = _slugify(code)
            if slug in used_slugs:
                slug = f"{slug}-{attr['col']}"
            used_slugs.add(slug)
            id_for[(code, attr["code"])] = next_id
            description = attr["title_long"][:280]
            indicators.append(
                (next_id, slug, attr["name"], category, attr["unit"], description, "raw")
            )
            next_id += 1

    canonical = _canonical_regions()
    print(f"  canonical regions: {len(canonical)}")

    observations: list[tuple] = []
    seen: set[tuple] = set()
    levels = [("Laender", "CHAR_LENGTH(ags2)=2"), ("Kreise", "CHAR_LENGTH(ags2)=5")]

    for code, table in sorted(selected, key=lambda x: x[0]):
        attrs = _attr_model(table)
        cols = ",".join(a["col"] for a in attrs)
        tname = _table_name(code)
        stats = {}
        for label, where in levels:
            rows = _query(tname, where, f"ags2,jahr2,{cols}")
            kept = 0
            for feat in rows:
                a = feat.get("attributes", {})
                rid = _region_id(str(a.get("ags2") or ""))
                year = a.get("jahr2")
                if rid is None or rid not in canonical or not year:
                    continue
                year = int(year)
                for attr in attrs:
                    v = a.get(attr["col"])
                    if v is None:
                        continue
                    try:
                        fv = float(v)
                    except (TypeError, ValueError):
                        continue
                    if fv in SENTINELS or fv < -9998:
                        continue
                    key = (rid, id_for[(code, attr["code"])], year)
                    if key in seen:
                        continue
                    seen.add(key)
                    observations.append((rid, key[1], year, round(fv, 2), SOURCE_ID))
                    kept += 1
            stats[label] = kept
        print(f"  {code:<14} {table['title_short'][:44]:<44} {stats}")

    regions: list[tuple] = []  # regions come from the other fetchers
    sources = [
        (
            SOURCE_ID,
            "Statistische Ämter des Bundes und der Länder (Regionalatlas / Regionaldatenbank Deutschland)",
            "Regionalatlas Deutschland – Regionaldatenbank (ausgewählte Indikatoren)",
            SOURCE_URL,
            today,
        )
    ]

    _write_csv(OUT_DIR / "regions.csv", ["region_id", "name", "type", "parent_id", "area"], regions)
    _write_csv(
        OUT_DIR / "indicators.csv",
        ["indicator_id", "slug", "name", "category", "unit", "description", "raw_or_derived"],
        indicators,
    )
    _write_csv(
        OUT_DIR / "observations.csv",
        ["region_id", "indicator_id", "period", "value", "source_id"],
        observations,
    )
    _write_csv(OUT_DIR / "sources.csv", ["source_id", "provider", "dataset", "url", "retrieval_date"], sources)

    print(f"\nwrote staging CSVs to {OUT_DIR}")
    print(f"  indicators: {len(indicators)} | observations: {len(observations)}")


def _write_csv(path: Path, header: list[str], rows: list[tuple]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)


if __name__ == "__main__":
    main()
