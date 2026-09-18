import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/async-state"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { MapLegend, RegionsMap } from "@/components/regions-map"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useIndicators, useIndicatorPeriods, useRankings, useRegionGeoJson } from "@/lib/queries"

const LEVELS = ["bundesland", "kreis"] as const

export function ExplorePage() {
  const navigate = useNavigate()
  const [indicator, setIndicator] = useState("gdp_pc")
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("bundesland")
  const [period, setPeriod] = useState<number | undefined>(undefined)

  const indicators = useIndicators()
  const periods = useIndicatorPeriods(indicator, level)
  const effectivePeriod = period ?? periods.data?.periods[0]
  const ranking = useRankings(indicator, {
    level,
    order: "desc",
    limit: 500,
    period: effectivePeriod,
  })
  const geojson = useRegionGeoJson()

  const indicatorMeta = indicators.data?.find((i) => i.slug === indicator)
  const entries = ranking.data?.entries ?? []
  const values: Record<string, number> = {}
  for (const e of entries) values[e.region_id] = e.value

  if (indicators.isError || ranking.isError || geojson.isError) {
    return (
      <div className="container py-8">
        <PageHeader title="Explore" eyebrow="Karte" description="Indikatoren auf der Deutschlandkarte – nur aus dem realen Snapshot." />
        <ErrorState message={String((ranking.error ?? indicators.error ?? geojson.error)?.message ?? "Fehler")} onRetry={() => undefined} />
      </div>
    )
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Explore"
        eyebrow="Karte"
        description={
          indicatorMeta
            ? `${indicatorMeta.name} – ${indicatorMeta.unit ?? ""} · geografischer Überblick.`
            : "Indikatoren auf der Deutschlandkarte – nur aus dem realen Snapshot."
        }
      />

      <FilterBar>
        <FilterField label="Indikator">
          <Select value={indicator} onChange={(e) => { setIndicator(e.target.value); setPeriod(undefined) }}>
            {(indicators.data ?? []).map((i) => (
              <option key={i.slug} value={i.slug}>{i.name}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Ebene">
          <Segmented value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l === "bundesland" ? "Bundesländer" : "Kreise" }))} />
        </FilterField>
        <FilterField label="Jahr">
          <Select value={String(effectivePeriod ?? "")} onChange={(e) => setPeriod(Number(e.target.value))}>
            {periods.isPending && <option value="">…</option>}
            {(periods.data?.periods ?? []).map((p) => (
              <option key={p} value={String(p)}>{p}</option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {geojson.isPending || ranking.isPending ? (
            <LoadingState label="Karte wird geladen …" />
          ) : ranking.data && ranking.data.count === 0 ? (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              Dieser Indikator liegt auf Ebene „{level}“ nicht vor.
            </p>
          ) : (
            <>
              <RegionsMap
                geojson={geojson.data!}
                values={values}
                unit={indicatorMeta?.unit}
                onSelect={(id) => navigate(`/region/${id}`)}
              />
              {entries.length > 0 && (
                <MapLegend
                  unit={indicatorMeta?.unit ?? undefined}
                  min={Math.min(...entries.map((e) => e.value))}
                  max={Math.max(...entries.map((e) => e.value))}
                />
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-8">
            <Kpi label="Bester Wert" value={entries[0]?.value ?? null} unit={indicatorMeta?.unit} hint={entries[0]?.name} />
            <Kpi label="Regionale ausgewertet" value={ranking.data?.count ?? null} unit="Regionen" />
          </div>
          <SourceNote />
        </div>

        <aside className="lg:border-l lg:pl-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Rangfolge (Top)</h2>
          <ol className="space-y-1.5">
            {(ranking.data?.entries ?? []).slice(0, 8).map((e) => (
              <li key={e.region_id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left text-sm hover:underline"
                  onClick={() => navigate(`/region/${e.region_id}`)}
                >
                  <span className="truncate font-medium">
                    <span className="mr-1.5 text-muted-foreground">{e.rank}.</span>
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