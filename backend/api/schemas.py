"""Pydantic response models for the read-only data API.

Small, frontend-friendly models. Every endpoint returns one of these - the API
never mutates and never recomputes heavy statistics on the request path
(it reads the precomputed snapshot).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

# ---------------------------------------------------------------- system


class SnapshotInfo(BaseModel):
    configured: bool
    path: str | None = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    snapshot: SnapshotInfo
    timestamp: datetime


# ---------------------------------------------------------------- core entities


class Region(BaseModel):
    region_id: str
    name: str
    type: str
    parent_id: str | None = None
    area: float | None = None


class Indicator(BaseModel):
    indicator_id: int
    slug: str
    name: str
    category: str
    unit: str
    description: str | None = None
    raw_or_derived: str
    levels: list[str]
    first_period: int | None = None
    latest_period: int | None = None
    observation_count: int = 0
    regions_with_data: int = 0
    source_ids: list[int] = []


class Source(BaseModel):
    source_id: int
    provider: str
    dataset: str
    url: str | None = None
    retrieval_date: str | None = None


# ---------------------------------------------------------------- series / profile


class SeriesPoint(BaseModel):
    period: int
    value: float
    absolute_change: float | None = None
    percentage_change: float | None = None


class RegionIndicatorSeries(BaseModel):
    region: Region
    indicator: Indicator
    series: list[SeriesPoint]


class Insight(BaseModel):
    indicator_id: int
    slug: str
    name: str
    category: str
    unit: str
    period: int | None = None
    value: float | None = None
    previous_value: float | None = None
    previous_period: int | None = None
    yoy_pct: float | None = None
    rank_desc: int | None = None
    rank_asc: int | None = None
    percentile: float | None = None
    vs_de_ratio: float | None = None
    vs_land_ratio: float | None = None


class TrendItem(BaseModel):
    indicator_id: int
    slug: str
    name: str
    category: str
    unit: str
    first_period: int | None = None
    latest_period: int | None = None
    first_value: float | None = None
    latest_value: float | None = None
    total_change_pct: float | None = None
    avg_annual_change_pct: float | None = None
    n_periods: int = 0


class RegionProfile(BaseModel):
    region: Region
    kpis: list[Insight]
    trends: list[TrendItem]


class NarrativeStatement(BaseModel):
    id: str
    text: str


class RegionNarratives(BaseModel):
    region_id: str
    statements: list[NarrativeStatement]


# ---------------------------------------------------------------- compare


class CompareRegion(BaseModel):
    region_id: str
    name: str
    series: list[SeriesPoint]


class CompareResponse(BaseModel):
    indicator: str
    regions: list[CompareRegion]


# ---------------------------------------------------------------- rankings


class RankingRow(BaseModel):
    rank: int
    region_id: str
    name: str
    type: str
    value: float
    percentile: float | None = None


class RankingsResponse(BaseModel):
    indicator: str
    period: int
    level: str
    count: int
    entries: list[RankingRow]


# ---------------------------------------------------------------- correlation


class CorrelationPoint(BaseModel):
    region_id: str
    name: str
    value_x: float | None = None
    value_y: float | None = None


class CorrelationResponse(BaseModel):
    x: str
    y: str
    level: str
    period: int | None = None
    n: int
    pearson: float | None = None
    spearman: float | None = None
    points: list[CorrelationPoint] = []
    note: str = "Correlation is not causation."


# ---------------------------------------------------------------- indicator periods


class PeriodsResponse(BaseModel):
    indicator: str
    level: str
    periods: list[int]


# ---------------------------------------------------------------- metadata


class MetadataResponse(BaseModel):
    snapshot: dict[str, str]
    indicators: list[Indicator]
    sources: list[Source]
