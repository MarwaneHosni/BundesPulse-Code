"""Fetch the public charging-infrastructure register (Bundesnetzagentur) and stage it.

Source: Bundesnetzagentur Ladesaeulenregister (official CSV, no credentials).
Each row is a charging facility with its *Kreis / kreisfreie Stadt* and the
number of charging points ("Ladepunkte").

Regional values produced:

* `chargers`                  - number of charging points per Kreis (raw)
* `chargers`                  - number of charging points per Bundesland/DE (sum over Kreise)
* `chargers_per_10k`          - charging points per 10,000 inhabitants (per Bundesland/DE),
                                normalised with the existing Destatis population (2024).

Staging CSVs go to ``data/processed/netzagentur/`` (gitignored).
"""

from __future__ import annotations

import csv
import difflib
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pipeline.source_regions import COUNTRY_ID, kreis_parent, normalize_kreis_name

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "data" / "raw" / "sources"
OUT_DIR = Path(
    os.environ.get(
        "BUNDESPULSE_PROCESSED_DIR", REPO_ROOT / "data" / "processed" / "netzagentur"
    )
)
DESTATIS_OBS = (
    Path(
        os.environ.get(
            "BUNDESPULSE_PROCESSED_DIR", REPO_ROOT / "data" / "processed" / "destatis"
        )
    )
    / "observations.csv"
)

# Bundesnetzagentur Ladesaeulenregister (dated CSV, replaced regularly).
REGISTER_URL = (
    "https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/"
    "E-Mobilitaet/Ladesaeulenregister_BNetzA_2026-07-28.csv"
)
REGISTER_FILE = "ladesaeulenregister.csv"

ID_CHARGERS, ID_CHARGERS_10K = 10, 11

HEADERS = {"User-Agent": "Mozilla/5.0"}


def download(url: str, dest: Path) -> None:
    if not dest.exists():
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=180) as resp, open(dest, "wb") as out:
            out.write(resp.read())
        print(f"  downloaded {dest.name} ({dest.stat().st_size:,} bytes)")
    else:
        print(f"  using cached {dest.name}")


def _read_register(path: Path) -> dict[str, int]:
    """Aggregate 'Anzahl Ladepunkte' per (normalised) Kreis name for operational facilities."""
    import csv as _csv

    points_by_kreis: dict[str, int] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = _csv.reader(fh, delimiter=";")
        header = None
        for row in reader:
            if not row or not row[0]:
                continue
            if row[0].strip() == "Ladeeinrichtungs-ID":
                header = {c.strip(): i for i, c in enumerate(row)}
                break
        if header is None:
            raise RuntimeError("Ladesaeulenregister: header row not found")
        need = {"Status", "Kreis/kreisfreie Stadt", "Anzahl Ladepunkte"}
        missing = need - set(header)
        if missing:
            raise RuntimeError(f"Ladesaeulenregister: missing columns {missing}")
        for row in reader:
            if not row or len(row) <= max(header.values()):
                continue
            status = row[header["Status"]].strip()
            kreis = row[header["Kreis/kreisfreie Stadt"]].strip()
            if status.lower() != "in betrieb" or not kreis:
                continue
            points = _to_int(row[header["Anzahl Ladepunkte"]])
            if points is None:
                continue
            key = normalize_kreis_name(kreis)
            points_by_kreis[key] = points_by_kreis.get(key, 0) + points
    return points_by_kreis


def _to_int(v) -> int | None:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def _to_float(v) -> float | None:
    try:
        return float(str(v).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _load_kreis_catalogue() -> tuple[dict[str, str], dict[str, str]]:
    """ring: normalised Kreis name -> ags, and ags -> parent land id."""
    ba_regions = REPO_ROOT / "data" / "processed" / "arbeitsagentur" / "regions.csv"
    name_to_ags: dict[str, str] = {}
    ags_to_land: dict[str, str] = {}
    if not ba_regions.exists():
        return name_to_ags, ags_to_land
    with open(ba_regions, newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if row and row[0] == "region_id":
                continue
            if row and len(row) >= 3:
                ags = row[0]
                name_to_ags[normalize_kreis_name(row[1])] = ags
                parent = kreis_parent(ags)
                if parent:
                    ags_to_land[ags] = parent
    return name_to_ags, ags_to_land


def _match_kreis(name: str, name_to_ags: dict[str, str]) -> str | None:
    """Match a register Kreis string to a catalogue AGS (exact, then fuzzy)."""
    key = normalize_kreis_name(name)
    if key in name_to_ags:
        return name_to_ags[key]
    # City-states: the register lists them as "Kreisfreie Stadt X".
    if key == "Berlin":
        return "11"
    if key == "Hamburg":
        return "02"
    best, best_score = None, 0.0
    for cand, cand_ags in name_to_ags.items():
        score = difflib.SequenceMatcher(None, key, cand).ratio()
        if score > best_score:
            best, best_score = cand_ags, score
    return best if best_score >= 0.85 else None


def _load_population() -> dict[str, float]:
    """Land id -> population (latest period, Destatis 2024)."""
    pop: dict[str, float] = {}
    if not DESTATIS_OBS.exists():
        return pop
    with open(DESTATIS_OBS, newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if row and row[0] == "region_id":
                continue
            if row and len(row) >= 5 and row[1] == "1":
                pop.setdefault(row[0], float(row[3]))
    return pop


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date().isoformat()

    print("- BNetzA: Ladesaeulenregister")
    reg = RAW_DIR / REGISTER_FILE
    download(REGISTER_URL, reg)
    points_by_kreis = _read_register(reg)
    print(f"  facilities aggregated for {len(points_by_kreis)} distinct Kreise")

    name_to_ags, ags_to_land = _load_kreis_catalogue()

    # per-Kreis charging points (match register Kreis name -> AGS)
    chargers_kreis: dict[str, int] = {}
    unmatched = []
    for kname, points in points_by_kreis.items():
        ags = _match_kreis(kname, name_to_ags)
        if ags:
            chargers_kreis[ags] = chargers_kreis.get(ags, 0) + points
        else:
            unmatched.append(kname)
    print(
        f"  matched {len(chargers_kreis)} Kreise, unmatched register entries: {len(unmatched)}"
    )
    if unmatched:
        print(f"  sample unmatched: {sorted(unmatched)[:12]}")

    # per-Land (and DE) charging points + per-10k inhabitants
    chargers_land: dict[str, int] = {}
    for ags, points in chargers_kreis.items():
        land = ags_to_land.get(ags)
        if land:
            chargers_land[land] = chargers_land.get(land, 0) + points
    chargers_land[COUNTRY_ID] = sum(chargers_land.values())

    population = _load_population()

    chargers_per_10k: dict[str, float] = {}
    for land, points in chargers_land.items():
        pop = population.get(land)
        if pop:
            chargers_per_10k[land] = round(points / pop * 10_000.0, 2)

    indicators = [
        (
            ID_CHARGERS,
            "chargers",
            "Öffentlich zugängliche Ladepunkte (E-Autos)",
            "Infrastructure",
            "points",
            "Ladepunkte laut Ladesaeulenregister der Bundesnetzagentur",
            "raw",
        ),
        (
            ID_CHARGERS_10K,
            "chargers_per_10k",
            "Ladepunkte je 10 000 Einwohner",
            "Infrastructure",
            "per 10 000",
            "Ladepunkte je 10 000 Einwohner (auf Basis der Bevölkerungsfortschreibung 2024)",
            "derived",
        ),
    ]
    sources = [
        (
            1,
            "Bundesnetzagentur",
            "Ladesaeulenregister (öffentlich zugängliche Ladepunkte)",
            REGISTER_URL,
            today,
        ),
    ]

    obs = []
    for ags, val in chargers_kreis.items():
        obs.append((ags, ID_CHARGERS, 2026, float(val), 1))
    for land, val in chargers_land.items():
        obs.append((land, ID_CHARGERS, 2026, float(val), 1))
    for land, val in chargers_per_10k.items():
        obs.append((land, ID_CHARGERS_10K, 2026, val, 1))

    _write_csv(
        OUT_DIR / "regions.csv", ["region_id", "name", "type", "parent_id", "area"], []
    )
    _write_csv(
        OUT_DIR / "indicators.csv",
        [
            "indicator_id",
            "slug",
            "name",
            "category",
            "unit",
            "description",
            "raw_or_derived",
        ],
        indicators,
    )
    _write_csv(
        OUT_DIR / "observations.csv",
        ["region_id", "indicator_id", "period", "value", "source_id"],
        obs,
    )
    _write_csv(
        OUT_DIR / "sources.csv",
        ["source_id", "provider", "dataset", "url", "retrieval_date"],
        sources,
    )

    print(f"\nwrote staging CSVs to {OUT_DIR}")
    print(f"  indicators: {len(indicators)} | observations: {len(obs)}")
    for land in sorted(chargers_land):
        print(
            f"    {land}: chargers={chargers_land[land]} per10k={chargers_per_10k.get(land)}"
        )


def _write_csv(path: Path, header: list[str], rows: list[tuple]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    main()
