"""Prepare the BundesPulse DuckDB snapshot from staged CSVs.

The source fetchers (``pipeline/fetch_*.py``) write staging CSVs into
``data/processed/<source>/``. This build merges them into one snapshot:

    staging dirs (destatis, arbeitsagentur, netzagentur, umweltbundesamt, …)
      -> load + merge
      -> clean        (trim whitespace, drop empty cells)
      -> map IDs      (aliases -> canonical region_id, indicator slug -> id)
      -> normalize    (types, de-duplicate observations)
      -> validate     (fail on broken region IDs / invalid values)
      -> save to DuckDB  (data/snapshots/bundespulse.duckdb)

If no staged data exists, the committed ``data/raw/sample/`` set is used so the
build always runs. Nothing here runs at runtime - this is the offline
data-build step; the web app only ever reads the resulting snapshot.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import duckdb
import pandas as pd

# German data contains umlauts; print them regardless of the console codepage.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
SAMPLE_DIR = REPO_ROOT / "data" / "raw" / "sample"

# Order matters: earlier dirs win on duplicate region rows.
STAGE_DIRS = ["destatis", "arbeitsagentur", "netzagentur", "umweltbundesamt"]

SNAPSHOT_PATH = Path(
    os.environ.get(
        "BUNDESPULSE_SNAPSHOT", REPO_ROOT / "data" / "snapshots" / "bundespulse.duckdb"
    )
)

# Non-canonical ids used by some sources -> canonical region_id in regions.csv.
REGION_ID_ALIASES = {
    "DE-BW": "08",  # Baden-Württemberg
    "DE-BY": "09",  # Bayern
    "DEBS": "08111",  # Stuttgart (Stadtkreis)
}

MIN_YEAR, MAX_YEAR = 1990, 2100


class DataError(Exception):
    """The raw data is unusable; the build must fail."""


# ---------------------------------------------------------------- load / merge


def _stage_dirs() -> list[Path]:
    dirs = [PROCESSED_DIR / name for name in STAGE_DIRS]
    if not any((d / "observations.csv").exists() for d in dirs):
        print(f"no staged data found, using committed sample: {SAMPLE_DIR}")
        dirs = [SAMPLE_DIR]
    return dirs


def load_raw() -> dict[str, pd.DataFrame]:
    """Load and merge all staging dirs into the four canonical tables.

    Sources are numbered locally by each fetcher, so a per-directory offset is
    applied to ``source_id`` (in both sources and observations) to keep
    references consistent in the merged snapshot.
    """
    frames: dict[str, list[pd.DataFrame]] = {
        "regions": [],
        "indicators": [],
        "observations": [],
        "sources": [],
    }
    offset = 0
    dtype_map = {
        "regions.csv": {"region_id": str, "parent_id": str},
        "observations.csv": {"region_id": str},
    }
    for directory in _stage_dirs():
        files = {
            "regions": "regions.csv",
            "indicators": "indicators.csv",
            "observations": "observations.csv",
            "sources": "sources.csv",
        }
        present = {k: (directory / v).exists() for k, v in files.items()}
        if not all(present.values()):
            print(
                f"  skip {directory.name}: missing {[k for k, ok in present.items() if not ok]}"
            )
            continue
        src = pd.read_csv(directory / files["sources"], encoding="utf-8")
        obs = pd.read_csv(
            directory / files["observations"],
            dtype=dtype_map.get(files["observations"]),
            encoding="utf-8",
        )
        if offset:
            src["source_id"] = src["source_id"] + offset
            obs["source_id"] = obs["source_id"] + offset
        frames["sources"].append(src)
        frames["observations"].append(obs)
        frames["regions"].append(
            pd.read_csv(
                directory / files["regions"],
                dtype=dtype_map.get(files["regions"]),
                encoding="utf-8",
            )
        )
        frames["indicators"].append(
            pd.read_csv(directory / files["indicators"], encoding="utf-8")
        )
        print(
            f"  merged {directory.name}"
            + (f" (source offset +{offset})" if offset else "")
        )
        offset += 1000

    merged = {table: pd.concat(frames[table], ignore_index=True) for table in frames}
    return merged


def _strip_strings(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.select_dtypes(include="str").columns:
        df[col] = df[col].astype(str).str.strip().replace({"": None, "nan": None})
    return df


def clean(raw: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    cleaned = {
        name: _strip_strings(frame.dropna(how="all")) for name, frame in raw.items()
    }
    # Keep a single definition per region/indicator (first dir wins).
    cleaned["regions"] = cleaned["regions"].drop_duplicates(subset=["region_id"])
    cleaned["indicators"] = cleaned["indicators"].drop_duplicates(
        subset=["indicator_id"]
    )
    return cleaned


# ---------------------------------------------------------------- map ids


def map_ids(frames: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    regions, indicators, observations = (
        frames["regions"],
        frames["indicators"],
        frames["observations"],
    )

    canonical = set(regions["region_id"].astype(str))
    slug_to_id = {
        str(k): v for k, v in zip(indicators["slug"], indicators["indicator_id"])
    }

    obs = observations.copy()
    obs["region_id"] = obs["region_id"].astype(str)
    # Map source-level region aliases to canonical ids.
    obs["region_id"] = obs["region_id"].map(lambda rid: REGION_ID_ALIASES.get(rid, rid))
    # Indicators: support either slug column ("indicator") or pre-mapped numeric ids.
    if "indicator" in obs.columns:
        obs["indicator_id"] = obs["indicator"].map(slug_to_id)
        obs = obs.drop(columns=["indicator"])
    obs["indicator_id"] = obs["indicator_id"].astype(str)

    # Anything still missing was not known -> broken reference.
    unknown_regions = sorted(set(obs["region_id"]) - canonical)
    unknown_indicators = sorted(
        set(obs["indicator_id"]) - {str(v) for v in slug_to_id.values()}
    )
    if unknown_regions:
        raise DataError(f"Observations reference unknown regions: {unknown_regions}")
    if unknown_indicators:
        raise DataError(
            f"Observations reference unknown indicators: {unknown_indicators}"
        )

    frames["observations"] = obs
    return frames


# ---------------------------------------------------------------- normalize


def normalize(frames: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    obs = frames["observations"].copy()
    obs["region_id"] = obs["region_id"].astype(str)
    obs["indicator_id"] = obs["indicator_id"].astype(int)
    obs["period"] = obs["period"].astype(int)
    obs["value"] = obs["value"].astype(float)
    obs["source_id"] = obs["source_id"].astype(int)

    # "Obviously invalid values" gate runs before de-duplication so a row cannot
    # be hidden behind an identical (region, indicator, period) key.
    bad_value = obs["value"].isna() | (obs["value"].abs() >= float("inf"))
    if bad_value.any():
        raise DataError("observations: missing or non-finite values present")
    bad_period = ~obs["period"].between(MIN_YEAR, MAX_YEAR)
    if bad_period.any():
        raise DataError(
            f"observations: periods outside [{MIN_YEAR}, {MAX_YEAR}]: "
            f"{sorted(obs.loc[bad_period, 'period'].unique())}"
        )

    before = len(obs)
    obs = obs.drop_duplicates(
        subset=["region_id", "indicator_id", "period"]
    ).reset_index(drop=True)
    if len(obs) < before:
        print(f"  dropped {before - len(obs)} duplicate observation row(s)")

    # Match the table's column order exactly (independent of CSV column order).
    frames["observations"] = obs[
        ["region_id", "indicator_id", "period", "value", "source_id"]
    ]
    return frames


# ---------------------------------------------------------------- validate


def validate(frames: dict[str, pd.DataFrame]) -> None:
    regions, indicators, observations, sources = (
        frames["regions"],
        frames["indicators"],
        frames["observations"],
        frames["sources"],
    )

    # Regions. area is optional (not every source provides it); reject only
    # explicitly non-positive values, never "unknown" (NULL).
    if regions["region_id"].duplicated().any():
        raise DataError("regions: duplicate region_id values")
    bad_areas = regions[regions["area"].notna() & (regions["area"] <= 0)]
    if not bad_areas.empty:
        raise DataError(
            f"regions: non-positive area for {list(bad_areas['region_id'])}"
        )
    ids = set(regions["region_id"])
    bad_parents = regions[
        regions["parent_id"].notna() & ~regions["parent_id"].isin(ids)
    ]
    if not bad_parents.empty:
        raise DataError(
            f"regions: broken parent references {list(bad_parents['parent_id'])}"
        )

    # Indicators.
    if (
        indicators["indicator_id"].duplicated().any()
        or indicators["slug"].duplicated().any()
    ):
        raise DataError("indicators: duplicate indicator_id or slug")
    bad_kind = indicators[~indicators["raw_or_derived"].isin(["raw", "derived"])]
    if not bad_kind.empty:
        raise DataError(
            f"indicators: invalid raw_or_derived value(s): {list(bad_kind['raw_or_derived'])}"
        )

    # Observations: broken references.
    if not observations["region_id"].isin(ids).all():
        raise DataError(
            f"observations: unknown regions {sorted(set(observations['region_id']) - ids)}"
        )
    ind_ids = set(indicators["indicator_id"])
    if not observations["indicator_id"].isin(ind_ids).all():
        raise DataError("observations: unknown indicator_id values")

    # Sources.
    if sources["source_id"].duplicated().any():
        raise DataError("sources: duplicate source_id values")
    if sources["provider"].isna().any() or sources["dataset"].isna().any():
        raise DataError("sources: missing provider or dataset")


# ---------------------------------------------------------------- save

SCHEMA_SQL = """
CREATE TABLE regions (
    region_id  VARCHAR PRIMARY KEY,
    name       VARCHAR NOT NULL,
    type       VARCHAR NOT NULL,
    parent_id  VARCHAR,
    area       DOUBLE CHECK (area > 0)
);

CREATE TABLE indicators (
    indicator_id  INTEGER PRIMARY KEY,
    slug          VARCHAR NOT NULL UNIQUE,
    name          VARCHAR NOT NULL,
    category      VARCHAR NOT NULL,
    unit          VARCHAR NOT NULL,
    description   VARCHAR,
    raw_or_derived VARCHAR NOT NULL CHECK (raw_or_derived IN ('raw', 'derived'))
);

CREATE TABLE observations (
    region_id    VARCHAR NOT NULL,
    indicator_id INTEGER NOT NULL,
    period       INTEGER NOT NULL,
    value        DOUBLE NOT NULL,
    source_id    INTEGER NOT NULL,
    PRIMARY KEY (region_id, indicator_id, period)
);

CREATE TABLE sources (
    source_id      INTEGER PRIMARY KEY,
    provider       VARCHAR NOT NULL,
    dataset        VARCHAR NOT NULL,
    url            VARCHAR,
    retrieval_date DATE
);
"""


def save_to_duckdb(frames: dict[str, pd.DataFrame]) -> Path:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SNAPSHOT_PATH.exists():
        SNAPSHOT_PATH.unlink()  # the snapshot is a fresh build artifact

    sources = frames["sources"].copy()
    sources["retrieval_date"] = pd.to_datetime(sources["retrieval_date"]).dt.date

    with duckdb.connect(str(SNAPSHOT_PATH)) as conn:
        conn.execute(SCHEMA_SQL)
        conn.register("regions_df", frames["regions"])
        conn.register("indicators_df", frames["indicators"])
        conn.register("observations_df", frames["observations"])
        conn.register("sources_df", sources)
        conn.execute(
            "INSERT INTO regions SELECT region_id, name, type, parent_id, area FROM regions_df"
        )
        conn.execute(
            "INSERT INTO indicators SELECT indicator_id, slug, name, category, unit, "
            "description, raw_or_derived FROM indicators_df"
        )
        conn.execute(
            "INSERT INTO observations SELECT region_id, indicator_id, period, value, "
            "source_id FROM observations_df"
        )
        conn.execute(
            "INSERT INTO sources SELECT source_id, provider, dataset, url, retrieval_date FROM sources_df"
        )

    return SNAPSHOT_PATH


def verify(path: Path) -> None:
    with duckdb.connect(str(path), read_only=True) as conn:
        for table in ("regions", "indicators", "observations", "sources"):
            (count,) = conn.execute(f"SELECT count(*) FROM {table}").fetchone()
            print(f"  {table}: {count} rows")
        print("  sanity query (population 2023 by Bundesland):")
        for row in conn.execute(
            """
            SELECT r.name, o.value
            FROM observations o
            JOIN regions r ON r.region_id = o.region_id
            JOIN indicators i ON i.indicator_id = o.indicator_id
            WHERE i.slug = 'pop_total' AND o.period = 2023 AND r.type = 'bundesland'
            ORDER BY r.name
            """
        ).fetchall():
            print(f"    {row[0]:<22} {row[1]:,.0f}")


# ---------------------------------------------------------------- entry point


def main() -> None:
    raw = load_raw()
    for table, df in raw.items():
        print(f"  {table}: {len(df)} merged rows")
    print("cleaning ...")
    frames = clean(raw)
    print("mapping region/indicator ids ...")
    frames = map_ids(frames)
    print("normalizing ...")
    frames = normalize(frames)
    print("validating ...")
    validate(frames)

    path = save_to_duckdb(frames)
    print(f"written snapshot: {path}")
    verify(path)
    print("done.")


if __name__ == "__main__":
    main()
