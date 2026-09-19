import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state"
import { FilterBar, FilterField, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { MapLegend, RegionsMap, type RegionDatum } from "@/components/regions-map"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useIndicators, useIndicatorPeriods, useRankings, useRegionGeoJson } from "@/lib/queries"
import type { Indicator } from "@/lib/api"

const LEVEL = "bundesland"
const DEFAULT_INDICATOR = "gdp_pc"

function groupByCategory(indicators: Indicator[]): Array<[string, Indicator[]]> {
  const groups = new Map<string, Indicator[]>()
  for (const ind of indicators) {
    const list = groups.get(ind.category) ?? []
    list.push(ind)
    groups.set(ind.category, list)
  }
  return Array.from(groups.entries())
}

function isAvailableAtLevel(indicator: Indicator, level: string): boolean {
  return indicator.levels.includes(level)
}

export function ExplorePage() {
  const navigate = useNavigate()
  const [indicator, setIndicator] = useState(DEFAULT_INDICATOR)
  const [period, setPeriod] = useState<number | undefined>(undefined)

  const indicators = useIndicators()
  const periods = useIndicatorPeriods(indicator, LEVEL)
  const effectivePeriod = period ?? periods.data?.periods[0]
  const ranking = useRankings(indicator, {
    level: LEVEL,
    order: "desc",
    limit: 500,
    period: effectivePeriod,
  })
  const geojson = useRegionGeoJson()

  const available = useMemo(
    () => (indicators.data ?? []).filter((i) => isAvailableAtLevel(i, LEVEL)),
    [indicators.data],
  )
  const indicatorGroups = useMemo(() => groupByCategory(available), [available])

  const indicatorMeta = available.find((i) => i.slug === indicator)

  const bundeslaender = useMemo(
    () =>
      geojson.data
        ? {
            ...geojson.data,
            features: geojson.data.features.filter((f) => f.properties.type === LEVEL),
          }
        : undefined,
    [geojson.data],
  )

  const entries = ranking.data?.entries ?? []
  const data: Record<string, RegionDatum> = {}
  for (const e of entries) data[e.region_id] = { value: e.value, rank: e.rank }

  const countWithData = ranking.data?.count ?? null
  const geoCount = bundeslaender?.features.length ?? 0
  const missingCount = countWithData != null ? Math.max(0, geoCount - countWithData) : 0

  if (indicators.isError || ranking.isError || geojson.isError) {
    return (
      <div className="container py-8">
        <PageHeader
          title="Explore"
          eyebrow="Karte"
          description="Indikatoren auf der Deutschlandkarte – jeder Bundesland-Fläche aus dem echten Snapshot."
        />
        <ErrorState
          message={String((ranking.error ?? indicators.error ?? geojson.error)?.message ?? "Fehler")}
          onRetry={() => undefined}
        />
      </div>
    )
  }

  const description = indicatorMeta
    ? `${indicatorMeta.name} · ein Bundesland pro Fläche. Maus über eine Region, um Daten und Rang zu sehen.`
    : "Indikatoren auf der Deutschlandkarte – jeder Bundesland-Fläche aus dem echten Snapshot."

  return (
    <div className="container py-8">
      <PageHeader
        title="Explore"
        eyebrow="Karte"
        description={description}
      />

      <FilterBar>
        <FilterField label="Indikator">
          <Select
            value={indicator}
            onChange={(e) => {
              setIndicator(e.target.value)
              setPeriod(undefined)
            }}
          >
            {indicatorGroups.map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Jahr">
          <Select value={String(effectivePeriod ?? "")} onChange={(e) => setPeriod(Number(e.target.value))}>
            {periods.isPending && <option value="">…</option>}
            {(periods.data?.periods ?? []).map((p) => (
              <option key={p} value={String(p)}>
                {p}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {geojson.isPending || ranking.isPending || !bundeslaender ? (
            <LoadingState label="Karte wird geladen …" />
          ) : ranking.data && ranking.data.count === 0 ? (
            <EmptyState
              title="Keine Werte für diesen Indikator"
              description={`Der Indikator liegt auf Ebene „${LEVEL}“ nicht vor.`}
            />
          ) : (
            <>
              <RegionsMap
                geojson={bundeslaender}
                data={data}
                unit={indicatorMeta?.unit}
                rankTotal={countWithData ?? undefined}
                onSelect={(id) => navigate(`/region/${id}`)}
              />
              <MapLegend
                unit={indicatorMeta?.unit ?? undefined}
                min={Math.min(...entries.map((e) => e.value))}
                max={Math.max(...entries.map((e) => e.value))}
                hasMissing={missingCount > 0}
                missingCount={missingCount}
              />
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-10">
            <Kpi
              label="Bester Wert"
              value={entries[0]?.value ?? null}
              unit={indicatorMeta?.unit}
              hint={entries[0] ? `${entries[0].name} · Rang 1` : undefined}
            />
            <Kpi
              label="Regionen ausgewertet"
              value={countWithData}
              unit="Bundesländer"
              hint={countWithData != null ? `von ${geoCount} insgesamt` : undefined}
            />
          </div>
          <SourceNote />
        </div>

        <aside className="lg:border-l lg:pl-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Rangfolge</h2>
          <ol className="space-y-1.5">
            {(ranking.data?.entries ?? []).slice(0, 8).map((e) => (
              <li key={e.region_id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded px-1 py-1 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => navigate(`/region/${e.region_id}`)}
                >
                  <span className="truncate font-medium">
                    <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{e.rank}.</span>
                    {e.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(e.value)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}