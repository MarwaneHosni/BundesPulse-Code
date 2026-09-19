import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/async-state"
import { DataTable } from "@/components/data-table"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { MapLegend, RegionsMap, type RegionDatum } from "@/components/regions-map"
import { useIndicators, useIndicatorPeriods, useRankings, useRegionGeoJson } from "@/lib/queries"

const LEVEL_DEFAULTS: Record<string, string> = { bundesland: "gdp_pc", kreis: "unemp_rate" }

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })

export function RankingsPage() {
  const navigate = useNavigate()
  const [indicator, setIndicator] = useState(LEVEL_DEFAULTS.bundesland)
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [period, setPeriod] = useState<number | undefined>(undefined)
  const [limit, setLimit] = useState(20)

  const indicators = useIndicators()
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
  // fetch the full set (map must show the whole distribution; the table is sliced below)
  const ranking = useRankings(effectiveIndicator, {
    level,
    order,
    period: effectivePeriod,
    limit: 500,
    enabled: effectiveIndicator.length > 0,
  })

  const indicatorMeta = available.find((i) => i.slug === effectiveIndicator)
  // all ranked regions for the map/legend
  const allEntries = useMemo(() => ranking.data?.entries ?? [], [ranking.data])
  // table display is limited by the "Zeilen" control
  const entries = useMemo(() => allEntries.slice(0, limit), [allEntries, limit])

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

  const minV = useMemo(() => (allEntries.length ? Math.min(...allEntries.map((e) => e.value)) : 0), [allEntries])
  const maxV = useMemo(() => (allEntries.length ? Math.max(...allEntries.map((e) => e.value)) : 1), [allEntries])

  return (
    <div className="container py-8">
      <PageHeader
        title="Rankings"
        eyebrow="Rangliste"
        description="Regionale Reihenfolge für einen Indikator – Rang, Wert und Karte aus dem Snapshot."
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
        <FilterField label="Richtung">
          <Segmented
            value={order}
            onChange={setOrder}
            options={[
              { value: "desc", label: "Wert ↓ beste" },
              { value: "asc", label: "Wert ↑ beste" },
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
        <FilterField label="Zeilen">
          <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            {[20, 50, 100, 200].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-6 flex flex-wrap gap-10">
            <Kpi label="Regionen" value={ranking.data?.count ?? null} unit="mit Daten" />
            {entries[0] && (
              <Kpi label="Platz 1" value={entries[0].value} unit={indicatorMeta?.unit} hint={entries[0].name} />
            )}
          </div>

          {ranking.isPending ? (
            <LoadingState label="Ranking wird geladen …" />
          ) : ranking.isError ? (
            <ErrorState message={String(ranking.error?.message ?? "Fehler")} />
          ) : entries.length === 0 ? (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              Dieser Indikator liegt auf Ebene „{level}“ nicht vor.
            </p>
          ) : (
            <DataTable
              columns={[
                { key: "rank", header: order === "desc" ? "Rang (Wert ↓)" : "Rang (Wert ↑)" },
                {
                  key: "name",
                  header: "Region",
                  render: (e) => (
                    <Link className="hover:underline" to={`/region/${e.region_id}`}>
                      {e.name}
                    </Link>
                  ),
                },
                { key: "value", header: "Wert", align: "right", render: (e) => fmtN.format(e.value) },
                {
                  key: "pct",
                  header: "Perzentil",
                  align: "right",
                  render: (e) =>
                    e.percentile === null
                      ? "–"
                      : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(e.percentile),
                },
              ]}
              rows={entries}
              rowKey={(e) => e.region_id}
              dense
            />
          )}

          <div className="mt-2">
            <SourceNote />
          </div>
        </div>

        <aside className="lg:border-l lg:pl-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Karte</h2>
          {geojson.isPending || ranking.isPending || !regionsGeo ? (
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
          {indicatorMeta && (
            <p className="mt-3 text-xs text-muted-foreground">
              {indicatorMeta.name} · Stand {ranking.data?.period ?? effectivePeriod ?? "–"} · Rang beim Hovern
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}