"""Prepare the BundesPulse final DuckDB snapshot from staged CSVs.

The source fetchers (``pipeline/fetch_*.py``) write staging CSVs into
``data/processed/<source>/``. This build merges them into the production
snapshot under ``data/snapshot/``:

    staging dirs (destatis, destatis_more, arbeitsagentur, netzagentur, …)
      -> load + merge
      -> clean        (trim whitespace, drop empty cells)
      -> map IDs      (aliases -> canonical region_id, indicator slug -> id)
      -> normalize    (types, de-duplicate observations)
      -> validate     (fail on broken region IDs / invalid values)
      -> precompute   (rankings, trends, region summaries, insights)
      -> save to DuckDB  (data/snapshot/deutschland.duckdb)
      -> write regions.geojson + indicator_metadata.json

If no staged data exists, the committed ``data/raw/sample/`` set is used so the
build always runs. Nothing here runs at runtime - this is the offline
data-build step; the production web app only ever reads the resulting snapshot.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
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
STAGE_DIRS = [
    "destatis",
    "destatis_more",
    "arbeitsagentur",
    "netzagentur",
    "umweltbundesamt",
    "regionalatlas",
]

# Final production snapshot produced by this build (only what the app needs).
SNAPSHOT_DIR = REPO_ROOT / "data" / "snapshot"
SNAPSHOT_PATH = Path(
    os.environ.get("BUNDESPULSE_SNAPSHOT", SNAPSHOT_DIR / "deutschland.duckdb")
)
REGIONS_GEOJSON = SNAPSHOT_DIR / "regions.geojson"
INDICATOR_METADATA = SNAPSHOT_DIR / "indicator_metadata.json"

# Cached official BKG geometry (GeoDatabase VG250), used for regions.geojson
# and per-region area. Downloaded by the build on first run.
GEOM_PATH = REPO_ROOT / "data" / "raw" / "geography" / "DE_VG250.gpkg"
GEOM_URL = (
    "https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/"
    "vg250_01-01.utm32s.gpkg.ebenen.zip"
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

CREATE TABLE region_summaries (
    region_id     VARCHAR NOT NULL,
    indicator_id  INTEGER NOT NULL,
    periods       INTEGER NOT NULL,
    first_period  INTEGER,
    latest_period INTEGER,
    first_value   DOUBLE,
    latest_value  DOUBLE,
    min_value     DOUBLE,
    max_value     DOUBLE,
    mean_value    DOUBLE,
    PRIMARY KEY (region_id, indicator_id)
);

CREATE TABLE rankings (
    indicator_id INTEGER NOT NULL,
    period       INTEGER NOT NULL,
    level        VARCHAR NOT NULL,
    region_id    VARCHAR NOT NULL,
    value        DOUBLE NOT NULL,
    rank_desc    INTEGER,
    rank_asc     INTEGER,
    percentile   DOUBLE,
    PRIMARY KEY (indicator_id, period, level, region_id)
);

CREATE TABLE trends (
    region_id           VARCHAR NOT NULL,
    indicator_id        INTEGER NOT NULL,
    first_period        INTEGER,
    latest_period       INTEGER,
    first_value         DOUBLE,
    latest_value        DOUBLE,
    total_change_pct    DOUBLE,
    avg_annual_change_pct DOUBLE,
    n_periods           INTEGER,
    PRIMARY KEY (region_id, indicator_id)
);

CREATE TABLE insights (
    region_id      VARCHAR NOT NULL,
    indicator_id   INTEGER NOT NULL,
    period         INTEGER,
    value          DOUBLE,
    previous_value DOUBLE,
    previous_period INTEGER,
    yoy_pct        DOUBLE,
    rank_desc      INTEGER,
    rank_asc       INTEGER,
    percentile     DOUBLE,
    vs_de_ratio    DOUBLE,
    vs_land_ratio  DOUBLE,
    PRIMARY KEY (region_id, indicator_id)
);

CREATE TABLE snapshot_meta (
    key   VARCHAR PRIMARY KEY,
    value VARCHAR
);
"""


# ---------------------------------------------------------------- geometry


def _download_geometry() -> None:
    """Fetch the official BKG VG250 GeoDatabase (cached under data/raw/)."""
    if GEOM_PATH.exists():
        return

    GEOM_PATH.parent.mkdir(parents=True, exist_ok=True)
    zip_path = GEOM_PATH.parent / "vg250.gpkg.zip"
    if not zip_path.exists():
        req = urllib.request.Request(GEOM_URL, headers={"User-Agent": "Mozilla/5.0"})
        print(f"  downloading VG250 geometry ({GEOM_URL.split('/')[-1]}) ...")
        with (
            urllib.request.urlopen(req, timeout=600) as resp,
            open(zip_path, "wb") as out,
        ):
            out.write(resp.read())
    with (
        zipfile.ZipFile(zip_path) as zf,
        zf.open("vg250_ebenen_0101/DE_VG250.gpkg") as src,
        open(GEOM_PATH, "wb") as dst,
    ):
        dst.write(src.read())
    print(f"  cached geometry {GEOM_PATH.name} ({GEOM_PATH.stat().st_size:,} bytes)")


def _geometry_index() -> tuple[dict, dict]:
    """Return {(ags): simplified WGS84 geometry} and {(ags): area km2} for Länder + Kreise."""
    try:
        import geopandas as gpd
        from shapely.geometry import mapping  # noqa: F401  (used by the writer)
    except ImportError:
        return {}, {}
    try:
        _download_geometry()
    except (
        OSError,
        urllib.error.URLError,
        zipfile.BadZipFile,
    ) as err:  # geometry is optional
        print(f"  WARNING: geometry unavailable ({err}); skip regions.geojson / areas")
        return {}, {}
    geoms, areas = {}, {}
    for layer in ("vg250_lan", "vg250_krs"):
        gdf = gpd.read_file(GEOM_PATH, layer=layer)
        if gdf.empty:
            continue
        dissolved = gdf.dissolve(by="AGS")
        # area (km2) in the native projected CRS (UTM32)
        for ags, row in dissolved.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue
            areas[str(ags)] = float(geom.area / 1e6)
        # WGS84, simplified geometry for the map
        dissolved = dissolved.to_crs(4326)
        for ags, row in dissolved.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue
            geoms[str(ags)] = geom.simplify(0.0005, preserve_topology=True)
    return geoms, areas


def _write_regions_geojson(regions: pd.DataFrame, geometry: dict, areas: dict) -> None:
    """Write data/snapshot/regions.geojson (official boundaries, EPSG:4326)."""
    from shapely.geometry import mapping

    region_cols = {r.region_id: r for r in regions.itertuples(index=False)}
    features = []
    for region_id, r in region_cols.items():
        geom = geometry.get(region_id)
        if geom is None:
            continue
        r = region_cols[region_id]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "region_id": region_id,
                    "name": r.name,
                    "type": r.type,
                    "parent_id": r.parent_id,
                    "area_km2": round(float(areas.get(region_id, 0.0) or 0.0), 2),
                },
                "geometry": mapping(geom),
            }
        )
    fc = {
        "type": "FeatureCollection",
        "name": "deutschland-regions",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::4326"}},
        "features": features,
    }
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with open(REGIONS_GEOJSON, "w", encoding="utf-8") as fh:
        json.dump(fc, fh)
    print(f"  regions.geojson: {len(features)} features -> {REGIONS_GEOJSON}")


def _areas_from_geojson(path: Path) -> dict | None:
    """Read ``region_id -> area_km2`` from a previously written regions.geojson.

    The geography only changes when the region catalogue changes, so the
    expensive Geopackage read/dissolve is skipped on rebuilds.
    """
    try:
        with open(path, encoding="utf-8") as fh:
            fc = json.load(fh)
        areas = {
            str(f["properties"]["region_id"]): f["properties"].get("area_km2")
            for f in fc.get("features", [])
            if f.get("properties", {}).get("region_id")
        }
        return areas or None
    except (OSError, ValueError, KeyError) as err:
        print(f"  WARNING: could not reuse cached regions.geojson ({err})")
        return None


# ---------------------------------------------------------------- derived metrics


def _derived_frames(frames: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Precompute the useful, expensive results the app reads at runtime."""
    from backend.analytics.measures import percentage_change

    obs = frames["observations"].sort_values(["region_id", "indicator_id", "period"])
    regions = frames["regions"]
    type_map = dict(zip(regions["region_id"], regions["type"]))
    parent_map = dict(zip(regions["region_id"], regions["parent_id"]))

    # ---- region_summaries ----
    grouped = obs.groupby(["region_id", "indicator_id"], sort=False)
    head = grouped.head(1)  # first (earliest) row per group
    tail = grouped.tail(1)  # last (latest) row per group
    first_map = {
        (r, i): (p, v)
        for r, i, p, v in zip(
            head.region_id, head.indicator_id, head.period, head.value
        )
    }
    last_map = {
        (r, i): (p, v)
        for r, i, p, v in zip(
            tail.region_id, tail.indicator_id, tail.period, tail.value
        )
    }
    agg = (
        grouped["value"]
        .agg(periods="count", min_value="min", max_value="max", mean_value="mean")
        .reset_index()
    )
    summaries = pd.DataFrame(
        [
            {
                "region_id": r,
                "indicator_id": i,
                "periods": int(row["periods"]),
                "first_period": int(first_map[(r, i)][0]),
                "latest_period": int(last_map[(r, i)][0]),
                "first_value": first_map[(r, i)][1],
                "latest_value": last_map[(r, i)][1],
                "min_value": row["min_value"],
                "max_value": row["max_value"],
                "mean_value": row["mean_value"],
            }
            for (r, i), row in agg.set_index(["region_id", "indicator_id"]).iterrows()
        ]
    )

    # ---- rankings (per indicator x period x level, only groups with >= 2 regions) ----
    # Vectorised: rank_desc/rank_asc use competition ranking (ties share the best
    # rank, "1 2 2 4") which matches measures.rank(); percentile is the share of
    # group values <= the value (matches measures.percentile()).
    keys = ["indicator_id", "period", "type"]
    ranked = obs.merge(regions[["region_id", "type"]], on="region_id")
    ranked = ranked[ranked.groupby(keys)["value"].transform("size") >= 2].copy()
    grouped = ranked.groupby(keys)["value"]
    ranked["rank_desc"] = grouped.rank(method="min", ascending=False)
    ranked["rank_asc"] = grouped.rank(method="min", ascending=True)
    # percentile = share of group values <= value. rank(method="max", ascending=True)
    # equals count(values <= v), so percentile = that rank / n * 100 (vectorised,
    # identical to measures.percentile()).
    ranked["percentile"] = (
        grouped.rank(method="max", ascending=True) / grouped.transform("size") * 100.0
    ).round(2)
    rankings = (
        ranked.rename(columns={"type": "level"})[
            ["indicator_id", "period", "level", "region_id", "value", "rank_desc", "rank_asc", "percentile"]
        ]
        .reset_index(drop=True)
    )
    rankings["indicator_id"] = rankings["indicator_id"].astype(int)
    rankings["period"] = rankings["period"].astype(int)
    rankings["value"] = rankings["value"].astype(float)
    rankings["rank_desc"] = rankings["rank_desc"].astype(int)
    rankings["rank_asc"] = rankings["rank_asc"].astype(int)

    # ---- trends (per region x indicator with >= 2 points) ----
    trend_rows = []
    for _, row in summaries[summaries["periods"] >= 2].iterrows():
        r, i = row["region_id"], row["indicator_id"]
        pct = percentage_change(row["latest_value"], row["first_value"])
        span = max(row["latest_period"] - row["first_period"], 1)
        trend_rows.append(
            {
                "region_id": r,
                "indicator_id": i,
                "first_period": row["first_period"],
                "latest_period": row["latest_period"],
                "first_value": row["first_value"],
                "latest_value": row["latest_value"],
                "total_change_pct": None if pct is None else round(float(pct), 2),
                "avg_annual_change_pct": None
                if pct is None
                else round(float(pct) / span, 2),
                "n_periods": int(row["periods"]),
            }
        )
    trends = pd.DataFrame(
        trend_rows,
        columns=[
            "region_id",
            "indicator_id",
            "first_period",
            "latest_period",
            "first_value",
            "latest_value",
            "total_change_pct",
            "avg_annual_change_pct",
            "n_periods",
        ],
    )

    # ---- insights (latest period per region x indicator + context) ----
    mov = obs.copy()
    mov["previous_value"] = mov.groupby(["region_id", "indicator_id"])["value"].shift(1)
    mov["previous_period"] = mov.groupby(["region_id", "indicator_id"])["period"].shift(
        1
    )
    latest_period = mov.groupby(["region_id", "indicator_id"])["period"].transform(
        "max"
    )
    latest = mov[mov["period"] == latest_period].copy()

    rk_lookup = {
        (int(i), int(p), lvl, rid): (int(rd), int(ra), float(pc))
        for i, p, lvl, rid, rd, ra, pc in zip(
            rankings["indicator_id"],
            rankings["period"],
            rankings["level"],
            rankings["region_id"],
            rankings["rank_desc"],
            rankings["rank_asc"],
            rankings["percentile"],
        )
    }

    de = obs[obs["region_id"] == "DE"]
    de_index = de.set_index(["indicator_id", "period"])["value"]

    initial = obs.set_index(["region_id", "indicator_id", "period"])["value"]

    insight_rows = []
    for _, row in latest.iterrows():
        r, i = row["region_id"], row["indicator_id"]
        period = row["period"]
        level = type_map.get(r)
        rank_rec = rk_lookup.get((int(i), int(period), level, r)) if level else None
        vs_de = de_index.get((i, period))
        vs_land = None
        parent = parent_map.get(r)
        if parent:
            vs_land = initial.get((parent, i, period))
        insight_rows.append(
            {
                "region_id": r,
                "indicator_id": i,
                "period": int(period),
                "value": float(row["value"]),
                "previous_value": None
                if pd.isna(row["previous_value"])
                else float(row["previous_value"]),
                "previous_period": None
                if pd.isna(row["previous_period"])
                else int(row["previous_period"]),
                "yoy_pct": None
                if pd.isna(row["previous_value"])
                else percentage_change(row["value"], row["previous_value"]),
                "rank_desc": rank_rec[0] if rank_rec is not None else None,
                "rank_asc": rank_rec[1] if rank_rec is not None else None,
                "percentile": rank_rec[2] if rank_rec is not None else None,
                "vs_de_ratio": None
                if vs_de is None
                else float(row["value"]) / float(vs_de),
                "vs_land_ratio": None
                if vs_land is None or float(vs_land) == 0
                else float(row["value"]) / float(vs_land),
            }
        )
    insights = pd.DataFrame(
        insight_rows,
        columns=[
            "region_id",
            "indicator_id",
            "period",
            "value",
            "previous_value",
            "previous_period",
            "yoy_pct",
            "rank_desc",
            "rank_asc",
            "percentile",
            "vs_de_ratio",
            "vs_land_ratio",
        ],
    )

    return {
        "region_summaries": summaries,
        "rankings": rankings,
        "trends": trends,
        "insights": insights,
    }


# ---------------------------------------------------------------- write outputs


def _insert_df(conn, table: str, columns: list[str], df: pd.DataFrame) -> None:
    conn.register("df_insert", df)
    conn.execute(f"INSERT INTO {table} SELECT {', '.join(columns)} FROM df_insert")
    conn.unregister("df_insert")


def save_snapshot(frames: dict[str, pd.DataFrame], geometry: dict, areas: dict) -> Path:
    """Write the final production DuckDB snapshot plus geojson and metadata."""
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    if SNAPSHOT_PATH.exists():
        SNAPSHOT_PATH.unlink()

    frames = dict(frames)
    # Real official areas from the geometry (km2) when available.
    if areas:
        frames["regions"] = frames["regions"].copy()
        frames["regions"]["area"] = frames["regions"]["region_id"].map(areas)

    derived = _derived_frames(frames)
    sources = frames["sources"].copy()
    sources["retrieval_date"] = pd.to_datetime(sources["retrieval_date"]).dt.date

    with duckdb.connect(str(SNAPSHOT_PATH)) as conn:
        conn.execute(SCHEMA_SQL)
        _insert_df(
            conn,
            "regions",
            ["region_id", "name", "type", "parent_id", "area"],
            frames["regions"],
        )
        _insert_df(
            conn,
            "indicators",
            [
                "indicator_id",
                "slug",
                "name",
                "category",
                "unit",
                "description",
                "raw_or_derived",
            ],
            frames["indicators"],
        )
        _insert_df(
            conn,
            "observations",
            ["region_id", "indicator_id", "period", "value", "source_id"],
            frames["observations"],
        )
        _insert_df(
            conn,
            "sources",
            ["source_id", "provider", "dataset", "url", "retrieval_date"],
            sources,
        )
        for table in ("region_summaries", "rankings", "trends", "insights"):
            _insert_df(conn, table, list(derived[table].columns), derived[table])
        meta = [
            ("name", "deutschland"),
            ("built_at_utc", datetime.now(timezone.utc).isoformat()),
            ("region_catalogue", "BKG VG250 01.01.2026 / official AGS"),
            ("schema_version", "2"),
            ("purpose", "read-only production snapshot; no runtime ingestion"),
        ]
        _insert_df(
            conn,
            "snapshot_meta",
            ["key", "value"],
            pd.DataFrame(meta, columns=["key", "value"]),
        )

    _write_indicator_metadata(SNAPSHOT_PATH)
    if geometry:
        _write_regions_geojson(frames["regions"], geometry, areas)
    return SNAPSHOT_PATH


def _write_indicator_metadata(db_path: Path) -> None:
    """Write data/snapshot/indicator_metadata.json for the frontend catalog."""
    with duckdb.connect(str(db_path), read_only=True) as conn:
        rows = conn.execute(
            """
            SELECT i.indicator_id, i.slug, i.name, i.category, i.unit, i.description, i.raw_or_derived,
                   COALESCE(MIN(o.period), NULL) AS first_period,
                   COALESCE(MAX(o.period), NULL) AS latest_period,
                   COUNT(DISTINCT o.region_id) AS regions_with_data,
                   COUNT(*) AS observation_count,
                   GROUP_CONCAT(DISTINCT r.type) AS levels
              FROM indicators i
              LEFT JOIN observations o ON o.indicator_id = i.indicator_id
              LEFT JOIN regions r ON r.region_id = o.region_id
             GROUP BY i.indicator_id, i.slug, i.name, i.category, i.unit, i.description, i.raw_or_derived
             ORDER BY i.indicator_id
            """
        ).fetchall()
    cols = [
        "indicator_id",
        "slug",
        "name",
        "category",
        "unit",
        "description",
        "raw_or_derived",
        "first_period",
        "latest_period",
        "regions_with_data",
        "observation_count",
        "levels",
    ]
    metadata = []
    for row in rows:
        item = dict(zip(cols, row))
        item["levels"] = (
            None if item["levels"] is None else sorted(item["levels"].split(","))
        )
        item["first_period"] = (
            None if item["first_period"] is None else int(item["first_period"])
        )
        item["latest_period"] = (
            None if item["latest_period"] is None else int(item["latest_period"])
        )
        item["indicator_id"] = int(item["indicator_id"])
        item["observation_count"] = int(item["observation_count"])
        item["regions_with_data"] = int(item["regions_with_data"])
        metadata.append(item)
    with open(INDICATOR_METADATA, "w", encoding="utf-8") as fh:
        json.dump({"indicators": metadata}, fh, ensure_ascii=False, indent=2)
    print(
        f"  indicator_metadata.json: {len(metadata)} indicators -> {INDICATOR_METADATA}"
    )


def verify(path: Path) -> None:
    with duckdb.connect(str(path), read_only=True) as conn:
        for table in (
            "regions",
            "indicators",
            "observations",
            "sources",
            "region_summaries",
            "rankings",
            "trends",
            "insights",
            "snapshot_meta",
        ):
            (count,) = conn.execute(f"SELECT count(*) FROM {table}").fetchone()
            print(f"  {table}: {count} rows")
        print("  sanity (population 2023 by Bundesland):")
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
        print("  rankings sample (unemp_rate 2025, best 3):")
        for row in conn.execute(
            """
            SELECT r.name, k.rank_asc, k.value
            FROM rankings k JOIN regions r ON r.region_id = k.region_id
            JOIN indicators i ON i.indicator_id = k.indicator_id
            WHERE i.slug = 'unemp_rate' AND k.period = 2025 AND k.level = 'kreis'
            ORDER BY k.rank_asc LIMIT 3
            """
        ).fetchall():
            print(f"    {row[0]:<26} rank {row[1]} (quote {row[2]})")
        print("  insights sample (Bayern gdp_pc 2024):")
        for row in conn.execute(
            """
            SELECT r.name, i.slug, s.period, s.value, s.rank_desc, s.percentile, s.vs_de_ratio
            FROM insights s JOIN regions r ON r.region_id = s.region_id
            JOIN indicators i ON i.indicator_id = s.indicator_id
            WHERE i.slug = 'gdp_pc' AND r.name = 'Bayern'
            """
        ).fetchall():
            print(f"    {row}")


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

    print("geometry ...")
    areas = None
    if REGIONS_GEOJSON.exists() and not os.environ.get("BUNDESPULSE_REBUILD_GEOMETRY"):
        areas = _areas_from_geojson(REGIONS_GEOJSON)
    if areas:
        geometry: dict = {}
        print(
            f"  reusing cached {REGIONS_GEOJSON.name} ({len(areas)} regions; "
            f"set BUNDESPULSE_REBUILD_GEOMETRY=1 to rebuild)"
        )
    else:
        geometry, areas = _geometry_index()
    path = save_snapshot(frames, geometry, areas)
    print(f"written snapshot: {path}")
    verify(path)
    print("done.")


if __name__ == "__main__":
    main()
