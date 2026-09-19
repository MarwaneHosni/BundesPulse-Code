"""Read-only data endpoints over the prepared DuckDB snapshot.

Every route is a plain SELECT reading `data/snapshot/deutschland.duckdb`.
There is no writing, no runtime ingestion, and no dependency on external APIs.

Invalid region/indicator requests return 404; a missing snapshot returns 503.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.analytics.measures import absolute_change, correlation, percentage_change
from backend.api.schemas import (
    CompareRegion,
    CompareResponse,
    CorrelationPoint,
    CorrelationResponse,
    Indicator,
    Insight,
    MetadataResponse,
    NarrativeStatement,
    PeriodsResponse,
    RankingRow,
    RankingsResponse,
    Region,
    RegionIndicatorSeries,
    RegionNarratives,
    RegionProfile,
    SeriesPoint,
    Source,
    TrendItem,
)
from backend.config import REPO_ROOT, settings
from backend.db import SnapshotUnavailableError, get_connection, select_rows
from backend.insights.engine import build_narratives

router = APIRouter(tags=["data"])


def _conn():
    if settings.snapshot_path is None:
        raise HTTPException(
            status_code=503,
            detail="No snapshot configured. Build it with: python -m pipeline.build_data",
        )
    try:
        return get_connection()
    except SnapshotUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _fetch(conn, sql: str, params: list | None = None) -> list[dict]:
    """Run a SELECT and return rows as dicts (thread-safe, via db.select_rows)."""
    return select_rows(conn, sql, params)


def _fetch_one(conn, sql: str, params: list | None = None) -> dict | None:
    rows = _fetch(conn, sql, params)
    return rows[0] if rows else None


# ---------------------------------------------------------------- helpers


def _region_row(conn, region_id: str) -> dict:
    row = _fetch_one(
        conn,
        "SELECT region_id, name, type, parent_id, area FROM regions WHERE region_id = ?",
        [region_id],
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"region not found: {region_id}")
    return row


def _indicator_row(conn, slug: str) -> dict:
    row = _fetch_one(conn, "SELECT indicator_id, slug FROM indicators WHERE slug = ?", [slug])
    if row is None:
        raise HTTPException(status_code=404, detail=f"indicator not found: {slug}")
    return row


def _indicator_models(conn) -> list[Indicator]:
    rows = _fetch(
        conn,
        """
        SELECT i.indicator_id, i.slug, i.name, i.category, i.unit, i.description,
               i.raw_or_derived, MIN(o.period) AS first_period,
               MAX(o.period) AS latest_period, COUNT(o.value) AS observation_count,
               COUNT(DISTINCT o.region_id) AS regions_with_data,
               GROUP_CONCAT(DISTINCT r.type) AS levels,
               GROUP_CONCAT(DISTINCT o.source_id) AS source_ids
        FROM indicators i
        LEFT JOIN observations o ON o.indicator_id = i.indicator_id
        LEFT JOIN regions r ON r.region_id = o.region_id
        GROUP BY i.indicator_id, i.slug, i.name, i.category, i.unit, i.description, i.raw_or_derived
        ORDER BY i.indicator_id
        """,
    )
    out = []
    for d in rows:
        d["levels"] = sorted(d["levels"].split(",")) if d["levels"] else []
        raw_ids = d["source_ids"] or ""
        d["source_ids"] = sorted({int(x) for x in raw_ids.split(",") if x})
        out.append(Indicator.model_validate(d))
    return out


def _insight_rows(conn, region_id: str) -> list[dict]:
    return _fetch(
        conn,
        """
        SELECT i.indicator_id, i.slug, i.name, i.category, i.unit,
               n.period, n.value, n.previous_value, n.previous_period, n.yoy_pct,
               n.rank_desc, n.rank_asc, n.percentile, n.vs_de_ratio, n.vs_land_ratio
        FROM insights n
        JOIN indicators i ON i.indicator_id = n.indicator_id
        WHERE n.region_id = ?
        ORDER BY i.category, i.slug
        """,
        [region_id],
    )


def _series_rows(conn, region_id: str, indicator_id: int) -> list[SeriesPoint]:
    rows = _fetch(
        conn,
        "SELECT period, value FROM observations "
        "WHERE region_id = ? AND indicator_id = ? ORDER BY period",
        [region_id, indicator_id],
    )
    series: list[SeriesPoint] = []
    previous = None
    for row in rows:
        value = float(row["value"])
        series.append(
            SeriesPoint(
                period=int(row["period"]),
                value=value,
                absolute_change=absolute_change(value, previous),
                percentage_change=percentage_change(value, previous),
            )
        )
        previous = value
    return series


# ---------------------------------------------------------------- regions / indicators


@router.get("/regions", response_model=list[Region])
def list_regions(
    level: str | None = Query(default=None, description="filter by type: bundesland | kreis"),
) -> list[Region]:
    conn = _conn()
    if level:
        rows = _fetch(
            conn,
            "SELECT region_id, name, type, parent_id, area FROM regions "
            "WHERE type = ? ORDER BY type, name",
            [level],
        )
    else:
        rows = _fetch(
            conn,
            "SELECT region_id, name, type, parent_id, area FROM regions ORDER BY type, name",
        )
    return [Region(**r) for r in rows]


@router.get("/regions/{region_id}", response_model=Region)
def get_region(region_id: str) -> Region:
    return Region(**_region_row(_conn(), region_id))


@router.get("/indicators", response_model=list[Indicator])
def list_indicators() -> list[Indicator]:
    return _indicator_models(_conn())


# ---------------------------------------------------------------- region detail


@router.get("/regions/{region_id}/profile", response_model=RegionProfile)
def region_profile(region_id: str) -> RegionProfile:
    conn = _conn()
    region = Region(**_region_row(conn, region_id))

    insight_rows = _insight_rows(conn, region_id)
    trend_rows = _fetch(
        conn,
        """
        SELECT i.indicator_id, i.slug, i.name, i.category, i.unit,
               t.first_period, t.latest_period, t.first_value, t.latest_value,
               t.total_change_pct, t.avg_annual_change_pct, t.n_periods
        FROM trends t
        JOIN indicators i ON i.indicator_id = t.indicator_id
        WHERE t.region_id = ?
        ORDER BY i.category, i.slug
        """,
        [region_id],
    )
    return RegionProfile(
        region=region,
        kpis=[Insight(**r) for r in insight_rows],
        trends=[TrendItem(**r) for r in trend_rows],
    )


@router.get("/regions/{region_id}/insights", response_model=list[Insight])
def region_insights(region_id: str) -> list[Insight]:
    conn = _conn()
    _region_row(conn, region_id)
    return [Insight(**r) for r in _insight_rows(conn, region_id)]


@router.get("/regions/{region_id}/narratives", response_model=RegionNarratives)
def region_narratives(region_id: str) -> RegionNarratives:
    """Rule-based analytical statements for a region (generated from the snapshot)."""
    conn = _conn()
    region = _region_row(conn, region_id)
    statements = build_narratives(conn, region)
    return RegionNarratives(
        region_id=region_id,
        statements=[NarrativeStatement(id=s["id"], text=s["text"]) for s in statements],
    )


@router.get(
    "/regions/{region_id}/indicators/{indicator}",
    response_model=RegionIndicatorSeries,
)
def region_indicator_series(region_id: str, indicator: str) -> RegionIndicatorSeries:
    conn = _conn()
    region = Region(**_region_row(conn, region_id))
    ind = _indicator_row(conn, indicator)
    models = {m.indicator_id: m for m in _indicator_models(conn)}
    return RegionIndicatorSeries(
        region=region,
        indicator=models[ind["indicator_id"]],
        series=_series_rows(conn, region_id, ind["indicator_id"]),
    )


# ---------------------------------------------------------------- compare / rankings / correlation


@router.get("/compare", response_model=CompareResponse)
def compare_regions(
    regions: str = Query(description="comma-separated region ids (1-4)"),
    indicator: str = Query(default="pop_total", description="indicator slug"),
) -> CompareResponse:
    conn = _conn()
    ids = [r.strip() for r in regions.split(",") if r.strip()]
    if not ids or len(ids) > 4:
        raise HTTPException(status_code=400, detail="provide 1-4 region ids")
    ind = _indicator_row(conn, indicator)
    out: list[CompareRegion] = []
    for rid in ids:
        region = Region(**_region_row(conn, rid))
        out.append(
            CompareRegion(
                region_id=rid,
                name=region.name,
                series=_series_rows(conn, rid, ind["indicator_id"]),
            )
        )
    return CompareResponse(indicator=indicator, regions=out)


@router.get("/rankings", response_model=RankingsResponse)
def get_rankings(
    indicator: str = Query(description="indicator slug"),
    period: int | None = Query(default=None, description="year (defaults to the latest available)"),
    level: str = Query(default="bundesland", description="bundesland | kreis"),
    order: str = Query(
        default="desc", description="desc = largest value is best, asc = smallest is best"
    ),
    limit: int = Query(default=50, ge=1, le=500),
) -> RankingsResponse:
    conn = _conn()
    ind = _indicator_row(conn, indicator)
    if level not in ("bundesland", "kreis", "bund"):
        raise HTTPException(status_code=400, detail=f"invalid level: {level}")
    if order not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="order must be 'asc' or 'desc'")

    if period is None:
        row = _fetch_one(
            conn,
            "SELECT MAX(period) AS latest FROM rankings WHERE indicator_id = ? AND level = ?",
            [ind["indicator_id"], level],
        )
        period = int(row["latest"]) if row and row["latest"] is not None else None
        if period is None:
            return RankingsResponse(indicator=indicator, period=0, level=level, count=0, entries=[])
    else:
        period = int(period)

    rank_col = "rank_asc" if order == "asc" else "rank_desc"
    entries = []
    if rank_col in ("rank_asc", "rank_desc"):
        entries = _fetch(
            conn,
            f"""
            SELECT k.{rank_col} AS rank, k.region_id, r.name, r.type, k.value, k.percentile
            FROM rankings k JOIN regions r ON r.region_id = k.region_id
            WHERE k.indicator_id = ? AND k.period = ? AND k.level = ?
            ORDER BY k.{rank_col} ASC
            LIMIT ?
            """,
            [ind["indicator_id"], period, level, limit],
        )
    total = _fetch_one(
        conn,
        "SELECT count(*) AS n FROM rankings WHERE indicator_id = ? AND period = ? AND level = ?",
        [ind["indicator_id"], period, level],
    )
    return RankingsResponse(
        indicator=indicator,
        period=period,
        level=level,
        count=int(total["n"]) if total else 0,
        entries=[RankingRow(**r) for r in entries],
    )


def _level_values(conn, slug: str, period: int, level: str) -> list[tuple[str, float]]:
    return [
        (str(r["region_id"]), float(r["value"]))
        for r in _fetch(
            conn,
            """
            SELECT o.region_id, o.value
            FROM observations o
            JOIN indicators i ON i.indicator_id = o.indicator_id
            JOIN regions r ON r.region_id = o.region_id
            WHERE i.slug = ? AND o.period = ? AND r.type = ?
            """,
            [slug, period, level],
        )
    ]


@router.get("/correlation", response_model=CorrelationResponse)
def get_correlation(
    x: str = Query(description="indicator slug (x axis)"),
    y: str = Query(description="indicator slug (y axis)"),
    level: str = Query(default="bundesland", description="bundesland | kreis"),
    period: int | None = Query(
        default=None, description="year (defaults to the latest common year)"
    ),
) -> CorrelationResponse:
    conn = _conn()
    _indicator_row(conn, x)
    _indicator_row(conn, y)
    if level not in ("bundesland", "kreis", "bund"):
        raise HTTPException(status_code=400, detail=f"invalid level: {level}")

    if period is None:
        row = _fetch_one(
            conn,
            """
            SELECT o.period
            FROM observations o
            JOIN indicators i ON i.indicator_id = o.indicator_id
            JOIN regions r ON r.region_id = o.region_id
            WHERE i.slug IN (?, ?) AND r.type = ?
            GROUP BY o.period
            HAVING COUNT(DISTINCT i.slug) = 2 AND COUNT(DISTINCT o.region_id) >= 2
            ORDER BY o.period DESC LIMIT 1
            """,
            [x, y, level],
        )
        period = int(row["period"]) if row else None
        if period is None:
            return CorrelationResponse(x=x, y=y, level=level, period=None, n=0)

    xv = dict(_level_values(conn, x, period, level))
    yv = dict(_level_values(conn, y, period, level))
    common = [(xv[r], yv[r]) for r in xv if r in yv]
    xs = [p[0] for p in common]
    ys = [p[1] for p in common]
    names = {
        str(r["region_id"]): str(r["name"])
        for r in _fetch(conn, "SELECT region_id, name FROM regions")
    }
    points = [
        CorrelationPoint(region_id=rid, name=names.get(rid, rid), value_x=xv[rid], value_y=yv[rid])
        for rid in sorted(xv.keys() & yv.keys())
    ]
    return CorrelationResponse(
        x=x,
        y=y,
        level=level,
        period=period,
        n=len(xs),
        pearson=correlation(xs, ys, method="pearson")["coefficient"],
        spearman=correlation(xs, ys, method="spearman")["coefficient"],
        points=points,
    )


@router.get("/indicators/{slug}/periods", response_model=PeriodsResponse)
def indicator_periods(
    slug: str,
    level: str = Query(default="bundesland", description="bundesland | kreis"),
) -> PeriodsResponse:
    conn = _conn()
    _indicator_row(conn, slug)
    if level not in ("bundesland", "kreis", "bund"):
        raise HTTPException(status_code=400, detail=f"invalid level: {level}")
    rows = _fetch(
        conn,
        "SELECT DISTINCT period FROM rankings "
        "WHERE indicator_id = ? AND level = ? ORDER BY period DESC",
        [_indicator_row(conn, slug)["indicator_id"], level],
    )
    return PeriodsResponse(indicator=slug, level=level, periods=[int(r["period"]) for r in rows])


@router.get("/regions.geojson")
def regions_geojson():
    """Serve the official BKG region boundaries (EPSG:4326) for the map."""
    path = REPO_ROOT / "data" / "snapshot" / "regions.geojson"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="regions.geojson not found. Build it with: python -m pipeline.build_data",
        )
    return FileResponse(str(path), media_type="application/geo+json", filename="regions.geojson")


# ---------------------------------------------------------------- sources / metadata


@router.get("/sources", response_model=list[Source])
def list_sources() -> list[Source]:
    rows = _fetch(
        _conn(),
        "SELECT source_id, provider, dataset, url, "
        "CAST(retrieval_date AS VARCHAR) AS retrieval_date FROM sources ORDER BY source_id",
    )
    return [Source(**r) for r in rows]


@router.get("/metadata", response_model=MetadataResponse)
def get_metadata() -> MetadataResponse:
    conn = _conn()
    meta_rows = _fetch(conn, "SELECT key, value FROM snapshot_meta")
    meta = {str(r["key"]): str(r["value"]) for r in meta_rows}
    sources = _fetch(
        conn,
        "SELECT source_id, provider, dataset, url, "
        "CAST(retrieval_date AS VARCHAR) AS retrieval_date FROM sources ORDER BY source_id",
    )
    return MetadataResponse(
        snapshot=meta,
        indicators=_indicator_models(conn),
        sources=[Source(**r) for r in sources],
    )
