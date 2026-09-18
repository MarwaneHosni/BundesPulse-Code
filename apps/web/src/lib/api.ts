/**
 * Read-only API client for the Deutschland Digital Monitor backend.
 *
 * All requests are GET-only, matching the immutable/precomputed-data model.
 * In development the Vite dev server proxies `/api` to the FastAPI backend
 * (see vite.config.ts); in production the API must be served from the same
 * origin or behind a reverse proxy.
 */

export interface SnapshotInfo {
  configured: boolean
  path: string | null
}

export interface HealthResponse {
  status: string
  service: string
  version: string
  snapshot: SnapshotInfo
  timestamp: string
}

export interface Region {
  region_id: string
  name: string
  type: "bund" | "bundesland" | "kreis"
  parent_id: string | null
  area: number | null
}

export interface Indicator {
  indicator_id: number
  slug: string
  name: string
  category: string
  unit: string
  description: string | null
  raw_or_derived: "raw" | "derived"
  levels: string[]
  first_period: number | null
  latest_period: number | null
  observation_count: number
  regions_with_data: number
}

export interface Source {
  source_id: number
  provider: string
  dataset: string
  url: string | null
  retrieval_date: string | null
}

export interface SeriesPoint {
  period: number
  value: number
  absolute_change: number | null
  percentage_change: number | null
}

export interface Insight {
  indicator_id: number
  slug: string
  name: string
  category: string
  unit: string
  period: number | null
  value: number | null
  previous_value: number | null
  previous_period: number | null
  yoy_pct: number | null
  rank_desc: number | null
  rank_asc: number | null
  percentile: number | null
  vs_de_ratio: number | null
  vs_land_ratio: number | null
}

export interface TrendItem {
  indicator_id: number
  slug: string
  name: string
  category: string
  unit: string
  first_period: number | null
  latest_period: number | null
  first_value: number | null
  latest_value: number | null
  total_change_pct: number | null
  avg_annual_change_pct: number | null
  n_periods: number
}

export interface RegionProfile {
  region: Region
  kpis: Insight[]
  trends: TrendItem[]
}

export interface RegionIndicatorSeries {
  region: Region
  indicator: Indicator
  series: SeriesPoint[]
}

export interface CompareRegion {
  region_id: string
  name: string
  series: SeriesPoint[]
}

export interface CompareResponse {
  indicator: string
  regions: CompareRegion[]
}

export interface RankingRow {
  rank: number
  region_id: string
  name: string
  type: string
  value: number
  percentile: number | null
}

export interface RankingsResponse {
  indicator: string
  period: number
  level: string
  count: number
  entries: RankingRow[]
}

export interface CorrelationPoint {
  region_id: string
  name: string
  value_x: number | null
  value_y: number | null
}

export interface CorrelationResponse {
  x: string
  y: string
  level: string
  period: number | null
  n: number
  pearson: number | null
  spearman: number | null
  points: CorrelationPoint[]
  note: string
}

export interface PeriodsResponse {
  indicator: string
  level: string
  periods: number[]
}

export interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

export interface GeoJsonFeature {
  type: "Feature"
  properties: {
    region_id: string
    name: string
    type: string
    parent_id: string | null
    area_km2: number
  } & Record<string, unknown>
  geometry: GeoJsonGeometry | null
}

export interface RegionGeoJson {
  type: "FeatureCollection"
  name: string
  crs?: { type: string; properties: { name: string } }
  features: GeoJsonFeature[]
}

export interface MetadataResponse {
  snapshot: Record<string, string>
  indicators: Indicator[]
  sources: Source[]
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api"

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join("&")}` : ""
}

export async function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/health")
}

export async function fetchRegions(level?: string): Promise<Region[]> {
  return getJson<Region[]>(`/regions${qs({ level })}`)
}

export async function fetchRegion(regionId: string): Promise<Region> {
  return getJson<Region>(`/regions/${regionId}`)
}

export async function fetchIndicators(): Promise<Indicator[]> {
  return getJson<Indicator[]>("/indicators")
}

export async function fetchRegionProfile(regionId: string): Promise<RegionProfile> {
  return getJson<RegionProfile>(`/regions/${regionId}/profile`)
}

export async function fetchRegionInsights(regionId: string): Promise<Insight[]> {
  return getJson<Insight[]>(`/regions/${regionId}/insights`)
}

export async function fetchRegionSeries(regionId: string, indicator: string): Promise<RegionIndicatorSeries> {
  return getJson<RegionIndicatorSeries>(`/regions/${regionId}/indicators/${indicator}`)
}

export async function fetchCompare(regions: string[], indicator: string): Promise<CompareResponse> {
  return getJson<CompareResponse>(`/compare${qs({ regions: regions.join(","), indicator })}`)
}

export async function fetchRankings(
  indicator: string,
  opts: { period?: number; level?: string; order?: string; limit?: number } = {},
): Promise<RankingsResponse> {
  return getJson<RankingsResponse>(
    `/rankings${qs({ indicator, ...opts })}`,
  )
}

export async function fetchCorrelation(
  x: string,
  y: string,
  opts: { level?: string; period?: number } = {},
): Promise<CorrelationResponse> {
  return getJson<CorrelationResponse>(`/correlation${qs({ x, y, ...opts })}`)
}

export async function fetchIndicatorPeriods(slug: string, level: string): Promise<PeriodsResponse> {
  return getJson<PeriodsResponse>(`/indicators/${slug}/periods${qs({ level })}`)
}

export async function fetchRegionGeoJson(): Promise<RegionGeoJson> {
  const res = await fetch(`${API_BASE}/regions.geojson`, { headers: { Accept: "application/geo+json" } })
  if (!res.ok) throw new Error(`API ${res.status}: regions.geojson`)
  return res.json() as Promise<RegionGeoJson>
}

export async function fetchSources(): Promise<Source[]> {
  return getJson<Source[]>("/sources")
}

export async function fetchMetadata(): Promise<MetadataResponse> {
  return getJson<MetadataResponse>("/metadata")
}