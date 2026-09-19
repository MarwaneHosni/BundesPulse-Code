import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { MapLegend, RegionsMap, type RegionDatum } from "@/components/regions-map"
import { PageHeader } from "@/components/page-header"
import { useIndicators, useIndicatorPeriods, useRankings, useRegionGeoJson, useSources } from "@/lib/queries"
import type { RankingRow } from "@/lib/api"

const LEVEL_DEFAULTS: Record<string, string> = { bundesland: "pop_total", kreis: "unemp_rate" }

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(v)
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExplorerPage() {
  const navigate = useNavigate()
  const [indicator, setIndicator] = useState(LEVEL_DEFAULTS.bundesland)
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [period, setPeriod] = useState<number | undefined>(undefined)
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [limit, setLimit] = useState(50)

  const indicators = useIndicators()
  const sources = useSources()
  const geojson = useRegionGeoJson()

  const available = useMemo(
    () => (indicators.data ?? []).filter((i) => i.levels.includes(level)),
    [indicators.data, level],
  )
  const effectiveIndicator = available.some((i) => i.slug === indicator)
    ? indicator
    : (available.find((i) => i.slug === LEVEL_DEFAULTS[level])?.slug ?? available[0]?.slug ?? "")

  const periods = useIndicatorPeriods(effectiveIndicator, level)
  const effectivePeriod = period ?? periods.data?.periods[0]

  // fetch the full distribution; the table and chart are slices (the map must show everything)
  const ranking = useRankings(effectiveIndicator, {
    level,
    order,
    period: effectivePeriod,
    limit: 500,
    enabled: effectiveIndicator.length > 0,
  })
  const chartTop = useRankings(effectiveIndicator, {
    level,
    order,
    period: effectivePeriod,
    limit: 20,
    enabled: effectiveIndicator.length > 0,
  })

  const indicatorMeta = available.find((i) => i.slug === effectiveIndicator)
  const allEntries = useMemo(() => ranking.data?.entries ?? [], [ranking.data])
  const entries = useMemo(() => allEntries.slice(0, limit), [allEntries, limit])

  const mean = useMemo(
    () => (allEntries.length ? allEntries.reduce((s, e) => s + e.value, 0) / allEntries.length : null),
    [allEntries],
  )

  const regionsGeo = useMemo(
    () =>
      geojson.data
        ? {
            ...geojson.data,
            features: geojson.data.features.filter((f) => f.properties.type === level),
          }
        : undefined,
    [geojson.data, level],
  )
  const mapData = useMemo(() => {
    const out: Record<string, RegionDatum> = {}
    for (const e of allEntries) out[e.region_id] = { value: e.value, rank: e.rank }
    return out
  }, [allEntries])
  const geoCount = regionsGeo?.features.length ?? 0
  const missingCount = ranking.data?.count != null ? Math.max(0, geoCount - ranking.data.count) : 0
  const minV = useMemo(
    () => (allEntries.length ? Math.min(...allEntries.map((e) => e.value)) : 0),
    [allEntries],
  )
  const maxV = useMemo(
    () => (allEntries.length ? Math.max(...allEntries.map((e) => e.value)) : 1),
    [allEntries],
  )

  const chartOption = useMemo(() => {
    const top = (chartTop.data?.entries ?? []).slice(0, 20)
    return {
      tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { formatter: (v: number) => new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v) } },
      yAxis: { type: "category", data: top.map((e) => e.name).reverse(), axisLabel: { fontSize: 12 } },
      series: [
        {
          type: "bar",
          data: top.map((e) => e.value).reverse(),
          itemStyle: { color: "#1d4f8a" },
          label: { show: true, position: "right", color: "#64748b", fontSize: 11, formatter: (p: { value: number }) => fmtN.format(p.value) },
        },
      ],
    }
  }, [chartTop.data])

  const relevantSources = useMemo(
    () => (sources.data ?? []).filter((s) => (indicatorMeta?.source_ids ?? []).includes(s.source_id)),
    [sources.data, indicatorMeta],
  )

  const csv = () => {
    if (!ranking.data) return
    const header = ["Rang", "Region", "Wert", "Perzentil"]
    const rows: string[][] = allEntries.map((e) => [
      String(e.rank),
      e.name,
      fmt(e.value, 4),
      e.percentile == null ? "" : String(e.percentile),
    ])
    downloadCsv(`${effectiveIndicator || "indikator"}_${ranking.data.period}_${level}.csv`, [header, ...rows])
  }

  const rowsForTable = entries

  return (
    <div className="container py-8">
      <PageHeader
        title="Data"
        eyebrow="Datentabelle"
        description="Indikator × Ebene × Jahr – Tabelle, Chart, Karte und CSV-Export, nur aus dem Snapshot."
      />

      <FilterBar>
        <FilterField label="Indikator">
          <Select
            value={effectiveIndicator}
            onChange={(e) => {
              setIndicator(e.target.value)
              setPeriod(undefined)
            }}
            className="max-w-72"
          >
            {available.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Ebene">
          <Segmented
            value={level}
            onChange={(l) => {
              setLevel(l)
              setPeriod(undefined)
            }}
            options={[
              { value: "bundesland", label: "Bundesländer" },
              { value: "kreis", label: "Kreise" },
            ]}
          />
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
        <FilterField label="Sortierung">
          <Segmented
            value={order}
            onChange={setOrder}
            options={[
              { value: "desc", label: "Wert ↓" },
              { value: "asc", label: "Wert ↑" },
            ]}
          />
        </FilterField>
        <FilterField label="Zeilen">
          <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            {[20, 50, 100, 200, 400].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {ranking.isError ? (
        <ErrorState message={String(ranking.error?.message ?? "Fehler")} />
      ) : ranking.isPending ? (
        <LoadingState label="Daten werden geladen …" />
      ) : ranking.data.count === 0 ? (
        <EmptyState
          title="Keine Werte für diese Auswahl"
          description={`Der Indikator liegt auf Ebene „${level}“ nicht vor.`}
        />
      ) : (
        <>
          {/* basic summary */}
          <div className="mb-6 flex flex-wrap gap-10">
            <Kpi label="Regionen" value={ranking.data?.count ?? null} unit="mit Daten" />
            {allEntries[0] && (
              <Kpi label="Bester Wert" value={allEntries[0].value} unit={indicatorMeta?.unit} hint={allEntries[0].name} />
            )}
            <Kpi label="Durchschnitt" value={mean} unit={indicatorMeta?.unit} />
            <Kpi label="Stand" value={ranking.data?.period ?? null} deltaSuffix="" />
          </div>

          <div className="mb-6 flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={csv}>
              <Download className="size-3.5" /> CSV herunterladen
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <DataTable
                columns={[
                  { key: "rank", header: order === "desc" ? "Rang (hoch)" : "Rang (niedrig)" },
                  {
                    key: "name",
                    header: "Region",
                    render: (e: RankingRow) => (
                      <Link className="hover:underline" to={`/region/${e.region_id}`}>
                        {e.name}
                      </Link>
                    ),
                  },
                  { key: "value", header: "Wert", align: "right", render: (e: RankingRow) => fmtN.format(e.value) },
                  {
                    key: "percentile",
                    header: "Perzentil",
                    align: "right",
                    render: (e: RankingRow) =>
                      e.percentile === null
                        ? "–"
                        : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(e.percentile),
                  },
                ]}
                rows={rowsForTable}
                rowKey={(e) => e.region_id}
                dense
              />
            </div>

            <aside className="lg:border-l lg:pl-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Top {Math.min(20, chartTop.data?.entries.length ?? 0)}
              </h2>
              {(chartTop.data?.entries.length ?? 0) > 0 && (
                <EChart option={chartOption} height={Math.min(20, chartTop.data?.entries.length ?? 0) * 22 + 40} />
              )}
            </aside>
          </div>

          {/* map */}
          <section className="mt-10 border-t pt-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Karte</h2>
            {!regionsGeo ? (
              <LoadingState label="Karte wird geladen …" />
            ) : (
              <>
                <RegionsMap
                  geojson={regionsGeo}
                  data={mapData}
                  unit={indicatorMeta?.unit}
                  rankTotal={ranking.data?.count}
                  onSelect={(id) => navigate(`/region/${id}`)}
                />
                <MapLegend
                  unit={indicatorMeta?.unit ?? undefined}
                  min={minV}
                  max={maxV}
                  hasMissing={missingCount > 0}
                  missingCount={missingCount}
                />
              </>
            )}
          </section>

          {/* sources */}
          {relevantSources.length > 0 && (
            <section className="mt-10 border-t pt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quelle</h2>
              <ul className="space-y-1 text-sm">
                {relevantSources.map((s) => (
                  <li key={s.source_id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{s.provider}</span>
                    <span className="text-muted-foreground">– {s.dataset}</span>
                    {s.url && (
                      <a
                        className="text-primary underline-offset-2 hover:underline"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Quelle
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">
                      (abgerufen am {s.retrieval_date ? new Date(s.retrieval_date + "T00:00:00").toLocaleDateString("de-DE") : "–"})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}