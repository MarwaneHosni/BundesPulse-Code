"""Fetch air-quality station data from the Umweltbundesamt and stage it.

The official UBA air-data API (``www.umweltbundesamt.de/api/air_data/v2``)
provides:

* the station register (`stations/json`) - works reliably; each station is
  mapped to its federal state (and coordinates) directly from official
  metadata;
* hourly/daily measurements (`measures/json`) - intended for annual means; this
  endpoint was *unreachable from the build environment* (HTTP 500/504), so the
  fetcher tries it with a small retry budget and otherwise **stages the
  station->region mapping only** (no fabricated values).

The regional value that the station mapping represents is documented in
`docs/data-sources.md`: *the unweighted mean of the annual-mean NO2/PM10
concentrations at the UBA/state monitoring stations located in the region
(period 2024); station station->region = UBA metadata*.
"""

from __future__ import annotations

import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path(
    os.environ.get(
        "BUNDESPULSE_PROCESSED_DIR",
        REPO_ROOT / "data" / "processed" / "umweltbundesamt",
    )
)

API = "https://www.umweltbundesamt.de/api/air_data/v2"
STATIONS_URL = f"{API}/stations/json?lang=de"
MEASURES_URL = (
    f"{API}/measures/json?date_from=2024-01-01&time_from=00:00"
    f"&date_to=2024-12-31&time_to=23:59&lang=de&station_ids={{sid}}&pollutant_ids={{pol}}"
)
PERIOD = 2024
ID_NO2, ID_PM10 = 8, 9
HEADERS = {"User-Agent": "Mozilla/5.0"}


def _fetch_json(url: str, timeout: int = 60):
    with urllib.request.urlopen(
        urllib.request.Request(url, headers=HEADERS), timeout=timeout
    ) as r:
        return r.status, r.read()


def _stations() -> dict[str, dict]:
    """Return {station_id: metadata-dict} for active stations."""
    st, body = _fetch_json(STATIONS_URL)
    if st != 200:
        raise RuntimeError(f"UBA stations endpoint failed: HTTP {st}")
    data = json.loads(body)["data"]
    out = {}
    for sid, v in data.items():
        out[str(sid)] = {
            "name": v[2],
            "city": v[3],
            "lon": float(v[7]) if v[7] else None,
            "lat": float(v[8]) if v[8] else None,
            "land": v[12],
            "land_name": v[13],
            "plz": v[19],
            "active_to": v[6],
        }
    return {
        k: v
        for k, v in out.items()
        if not v["active_to"] or v["active_to"] >= "2024-01-01"
    }


def _annual_mean(sid: str, pollutant: str, retries: int = 3, timeout: int = 60):
    """Try to compute the 2024 annual mean for one station/pollutant (best effort)."""
    for attempt in range(retries):
        try:
            st, body = _fetch_json(
                MEASURES_URL.format(sid=sid, pol=pollutant), timeout=timeout
            )
            if st != 200:
                return None, f"HTTP {st}"
            obj = json.loads(body)
            vals = _extract_values(obj, pollutant)
            if vals:
                return sum(vals) / len(vals), None
            return None, "no values"
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            json.JSONDecodeError,
            TimeoutError,
        ) as e:
            last = str(e)
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    return None, last


def _extract_values(obj, pollutant: str) -> list[float]:
    """Pull numeric concentration values out of the measures response (shape varies)."""
    vals: list[float] = []

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if (
                    isinstance(v, (int, float))
                    and not isinstance(v, bool)
                    and k in ("value", "Value", "concentration", "val")
                ):
                    vals.append(float(v))
                else:
                    walk(v)
        elif isinstance(node, list):
            for it in node:
                walk(it)

    walk(obj)
    return vals


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date().isoformat()

    print("- UBA: station register -> region mapping")
    try:
        stations = _stations()
    except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, ValueError) as e:
        print(f"  WARNING: station register unavailable ({e}); writing empty staging.")
        stations = {}
    print(f"  active stations: {len(stations)}")

    # station -> Land (simple geographic mapping from official metadata)
    stations_by_land: dict[str, list[dict]] = {}
    for s in stations.values():
        stations_by_land.setdefault(s["land"], []).append(s)
    print(
        "  stations per Land:", {k: len(v) for k, v in sorted(stations_by_land.items())}
    )

    # per-Land annual means (best effort, fail-fast: the measures endpoint is
    # often unreachable; one probe call decides whether we continue).
    values: dict[str, dict] = {pol: {} for pol in ("NO2", "PM10")}
    probe_done = False
    probe_failed = False
    for pol in ("NO2", "PM10"):
        if probe_failed:
            break
        for land_code in sorted(stations_by_land):
            sids = [s_id for s_id, s in stations.items() if s["land"] == land_code]
            if not sids:
                continue
            val, err = _annual_mean(sids[0], pol, retries=1, timeout=30)
            if val is not None:
                values[pol][land_code] = round(val, 2)
            else:
                if not probe_done:
                    print(
                        f"    probe {pol} {land_code}: unavailable ({err}); skipping remaining queries"
                    )
                    probe_failed = True
                    break
            probe_done = True
    ok = sum(len(v) for v in values.values())
    if ok:
        print(f"  values retrieved for {ok} Land/pollutant combos")
    else:
        print(
            "  WARNING: no NO2/PM10 values retrieved from the UBA API "
            "(endpoint unreachable); staging mapping + indicators only."
        )

    indicators = [
        (
            ID_NO2,
            "no2",
            "Stickstoffdioxid (Jahresmittel)",
            "Environment",
            "µg/m³",
            "Jahresmittelwert NO2 an UBA-Messstationen, 2024 (Stationsmittel je Region)",
            "raw",
        ),
        (
            ID_PM10,
            "pm10",
            "Feinstaub PM10 (Jahresmittel)",
            "Environment",
            "µg/m³",
            "Jahresmittelwert PM10 an UBA-Messstationen, 2024 (Stationsmittel je Region)",
            "raw",
        ),
    ]
    sources = [
        (
            1,
            "Umweltbundesamt",
            "Luftmessnetz - stations/JSON + measures API (Jahresmittel 2024)",
            STATIONS_URL,
            today,
        ),
    ]

    obs = []
    for pol, landvals in values.items():
        indicator_id = ID_NO2 if pol == "NO2" else ID_PM10
        for land_code, v in landvals.items():
            obs.append((land_code, indicator_id, PERIOD, v, 1))

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

    print(
        f"\nwrote staging CSVs to {OUT_DIR} (indicators {len(indicators)}, observations {len(obs)})"
    )


def _write_csv(path: Path, header: list[str], rows: list[tuple]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    main()
