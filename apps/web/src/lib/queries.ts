import { useQuery } from "@tanstack/react-query"
import {
  fetchCompare,
  fetchCorrelation,
  fetchHealth,
  fetchIndicators,
  fetchIndicatorPeriods,
  fetchMetadata,
  fetchRankings,
  fetchRegion,
  fetchRegionGeoJson,
  fetchRegionInsights,
  fetchRegionNarratives,
  fetchRegionProfile,
  fetchRegionSeries,
  fetchRegions,
  fetchSources,
  type CompareResponse,
  type CorrelationResponse,
  type HealthResponse,
  type Indicator,
  type Insight,
  type MetadataResponse,
  type PeriodsResponse,
  type RankingsResponse,
  type Region,
  type RegionGeoJson,
  type RegionIndicatorSeries,
  type RegionNarratives,
  type RegionProfile,
  type Source,
} from "@/lib/api"

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: 1,
    refetchInterval: 30_000,
  })
}

export function useRegions(level?: string) {
  return useQuery<Region[]>({
    queryKey: ["regions", level ?? "all"],
    queryFn: () => fetchRegions(level),
  })
}

export function useIndicators() {
  return useQuery<Indicator[]>({
    queryKey: ["indicators"],
    queryFn: fetchIndicators,
  })
}

export function useMetadata() {
  return useQuery<MetadataResponse>({
    queryKey: ["metadata"],
    queryFn: fetchMetadata,
  })
}

export function useSources() {
  return useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: fetchSources,
  })
}

export function useRegion(regionId: string) {
  return useQuery<Region>({
    queryKey: ["region", regionId],
    queryFn: () => fetchRegion(regionId),
  })
}

export function useRegionProfile(regionId: string) {
  return useQuery<RegionProfile>({
    queryKey: ["profile", regionId],
    queryFn: () => fetchRegionProfile(regionId),
  })
}

export function useRegionNarratives(regionId: string) {
  return useQuery<RegionNarratives>({
    queryKey: ["narratives", regionId],
    queryFn: () => fetchRegionNarratives(regionId),
    enabled: regionId.length > 0,
  })
}

export function useRegionInsights(regionId: string) {
  return useQuery<Insight[]>({
    queryKey: ["insights", regionId],
    queryFn: () => fetchRegionInsights(regionId),
  })
}

export function useRegionSeries(regionId: string, indicator: string, opts: { enabled?: boolean } = {}) {
  return useQuery<RegionIndicatorSeries>({
    queryKey: ["series", regionId, indicator],
    queryFn: () => fetchRegionSeries(regionId, indicator),
    enabled: opts.enabled !== false && regionId.length > 0 && indicator.length > 0,
  })
}

export function useCompare(regions: string[], indicator: string) {
  return useQuery<CompareResponse>({
    queryKey: ["compare", regions.join(","), indicator],
    queryFn: () => fetchCompare(regions, indicator),
    enabled: regions.length > 0,
  })
}

export function useRankings(
  indicator: string,
  opts: { level?: string; order?: string; limit?: number; period?: number; enabled?: boolean } = {},
) {
  return useQuery<RankingsResponse>({
    queryKey: [
      "rankings",
      indicator,
      opts.level ?? "bundesland",
      opts.order ?? "desc",
      opts.period ?? "latest",
    ],
    queryFn: () => fetchRankings(indicator, opts),
    enabled: opts.enabled !== false && indicator.length > 0,
  })
}

export function useCorrelation(
  x: string,
  y: string,
  opts: { level?: string; period?: number } = {},
) {
  return useQuery<CorrelationResponse>({
    queryKey: ["correlation", x, y, opts.level ?? "bundesland", opts.period ?? "latest"],
    queryFn: () => fetchCorrelation(x, y, opts),
    enabled: x.length > 0 && y.length > 0,
  })
}

export function useIndicatorPeriods(slug: string, level: string) {
  return useQuery<PeriodsResponse>({
    queryKey: ["periods", slug, level],
    queryFn: () => fetchIndicatorPeriods(slug, level),
    enabled: slug.length > 0,
  })
}

export function useRegionGeoJson() {
  return useQuery<RegionGeoJson>({
    queryKey: ["regions.geojson"],
    queryFn: fetchRegionGeoJson,
    staleTime: Infinity,
  })
}