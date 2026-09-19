import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { ErrorState, LoadingState } from "@/components/async-state"
import { DataTable } from "@/components/data-table"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { fetchRegionProfile } from "@/lib/api"
import { useCompare, useIndicators, useRegions } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { Insight } from "@/lib/api"

const LEVEL_DEFAULTS: Record<string, string> = { bundesland: "gdp_pc", kreis: "unemp_rate" }
const MAX_REGIONS = 4

const COLORS = ["#C1121F", "#E8A200", "#111111", "#2E6E68"]

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(v)
}

export function ComparePage() {
  const navigate = useNavigate()
  const [indicator, setIndicator] = useState(LEVEL_DEFAULTS.bundesland)
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [selected, setSelected] = useState<string[]>(["09", "08"])

  const indicators = useIndicators()
  const bundeslaender = useRegions("bundesland")
  const kreise = useRegions("kreis")

  const available = useMemo(
    () => (indicators.data ?? []).filter((i) => i.levels.includes(level)),
    [indicators.data, level],
  )
  const effectiveIndicator = available.some((i) => i.slug === indicator)
    ? indicator
    : (available.find((i) => i.slug === LEVEL_DEFAULTS[level])?.slug ?? available[0]?.slug ?? "")

  const selectorOptions = level === "bundesland" ? bundeslaender.data ?? [] : kreise.data ?? []

  const toggle = (id: string) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((r) => r !== id) : cur.length >= MAX_REGIONS ? cur : [...cur, id],
    )
  }
  const changeLevel = (l: "bundesland" | "kreis") => {
    setLevel(l)
    setSelected([])
  }

  const compare = useCompare(selected, effectiveIndicator)
  const indicatorMeta = available.find((i) => i.slug === effectiveIndicator)

  const chartOption = useMemo(() => {
    const series = compare.data?.regions ?? []
    const periods = Array.from(new Set(series.flatMap((r) => r.series.map((p) => p.period)))).sort()
    const unit = indicatorMeta?.unit ?? ""
    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "line" as const },
        valueFormatter: (v: number | null) => (v == null ? "–" : `${fmt(v)}${unit ? ` ${unit}` : ""}`),
      },
      legend: { bottom: 0, icon: "roundRect", itemWidth: 12, itemHeight: 3 },
      grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
      xAxis: { type: "category", data: periods, name: "Jahr" },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { formatter: (v: number) => new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v) },
      },
      series: series.map((r) => ({
        name: r.name,
        type: "line" as const,
        smooth: true,
        symbol: "circle" as const,
        symbolSize: 5,
        data: periods.map((p) => r.series.find((s) => s.period === p)?.value ?? null),
        lineStyle: { width: 2 },
      })),
      color: COLORS,
    }
  }, [compare.data, indicatorMeta?.unit])

  const latestRows = useMemo(
    () =>
      (compare.data?.regions ?? []).map((r) => {
        const last = r.series[r.series.length - 1]
        return { region: r, last }
      }),
    [compare.data],
  )

  return (
    <div className="container py-8">
      <PageHeader
        title="Compare"
        eyebrow="Vergleich"
        description="2–4 Regionen, ein Indikator – synchronisierte Zeitreihen und automatische Unterschiede aus dem Snapshot."
      />

      <FilterBar>
        <FilterField label="Indikator">
          <Select
            value={effectiveIndicator}
            onChange={(e) => setIndicator(e.target.value)}
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
            onChange={changeLevel}
            options={[
              { value: "bundesland", label: "Bundesländer" },
              { value: "kreis", label: "Kreise" },
            ]}
          />
        </FilterField>
        <FilterField label={`Regionen (${selected.length}/${MAX_REGIONS})`}>
          {level === "bundesland" ? (
            <div className="flex max-w-2xl flex-wrap gap-1.5">
              {selectorOptions.map((r) => (
                <button
                  key={r.region_id}
                  type="button"
                  onClick={() => toggle(r.region_id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selected.includes(r.region_id)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                  )}
                >
                  {r.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Select
                value=""
                disabled={selected.length >= MAX_REGIONS}
                className="max-w-72"
                onChange={(e) => {
                  toggle(e.target.value)
                }}
              >
                <option value="" disabled>
                  {selected.length >= MAX_REGIONS ? "Maximal 4 Regionen gewählt" : "Kreis hinzufügen …"}
                </option>
                {selectorOptions
                  .filter((r) => !selected.includes(r.region_id))
                  .map((r) => (
                    <option key={r.region_id} value={r.region_id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const r = kreise.data?.find((k) => k.region_id === id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {r?.name ?? id}
                      <button
                        type="button"
                        aria-label={`${r?.name ?? id} entfernen`}
                        onClick={() => setSelected((cur) => cur.filter((x) => x !== id))}
                        className="rounded-full hover:bg-primary/20"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </FilterField>
      </FilterBar>

      {selected.length === 0 && (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Bitte mindestens eine Region wählen.
        </p>
      )}

      {selected.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {/* main KPI comparison */}
            {latestRows.length > 0 && (
              <div className={cn("grid gap-x-10 gap-y-6", latestRows.length > 2 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-2")}>
                {latestRows.map(({ region, last }, i) => (
                  <CompareStat
                    key={region.region_id}
                    name={region.name}
                    value={last?.value ?? null}
                    unit={indicatorMeta?.unit}
                    period={last?.period ?? null}
                    pct={last?.percentage_change ?? null}
                    abs={last?.absolute_change ?? null}
                    color={COLORS[i % COLORS.length]}
                    onClick={() => navigate(`/region/${region.region_id}`)}
                  />
                ))}
              </div>
            )}

            <h2 className="mt-8 mb-3 text-sm font-medium text-muted-foreground">Zeitreihe</h2>
            {compare.isError && <ErrorState message={String(compare.error?.message ?? "Fehler")} />}
            {compare.isPending ? (
              <LoadingState label="Vergleich wird geladen …" />
            ) : compare.data && compare.data.regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Für diese Auswahl liegen keine Daten vor.</p>
            ) : (
              <EChart option={chartOption} height={380} />
            )}
            <SourceNote />
          </div>

          <aside className="lg:border-l lg:pl-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Letzter Stand</h2>
            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Region",
                  render: (r) => (
                    <Link to={`/region/${r.region.region_id}`} className="hover:underline">
                      {r.region.name}
                    </Link>
                  ),
                },
                { key: "value", header: "Wert", align: "right", render: (r) => fmt(r.last?.value) },
                {
                  key: "pct",
                  header: "Δ",
                  align: "right",
                  render: (r) =>
                    r.last?.percentage_change == null ? "–" : `${fmt(r.last.percentage_change)} %`,
                },
              ]}
              rows={latestRows}
              rowKey={(r) => r.region.region_id}
            />
            {indicatorMeta && (
              <p className="mt-3 text-xs text-muted-foreground">
                {indicatorMeta.name} · Stand {latestRows[0]?.last?.period ?? "–"}
              </p>
            )}
          </aside>
        </div>
      )}

      {selected.length >= 2 && <Differences regionIds={selected} />}
    </div>
  )
}

// ---------------------------------------------------------------- main KPI stat

function CompareStat({
  name,
  value,
  unit,
  period,
  pct,
  abs,
  color,
  onClick,
}: {
  name: string
  value: number | null
  unit?: string
  period: number | null
  pct: number | null
  abs: number | null
  color: string
  onClick: () => void
}) {
  const up = pct != null && pct >= 0
  return (
    <button type="button" onClick={onClick} className="border-t pt-3 text-left transition-opacity hover:opacity-80">
      <p className="flex items-center gap-2 truncate text-xs font-medium text-muted-foreground">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {name}
      </p>
      <p className="mt-1.5 text-[30px] font-semibold leading-[34px] tabular-nums tracking-tight">
        {fmt(value)}
        {unit && <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1.5 flex items-center gap-2 text-xs">
        <span className="tabular-nums" style={{ color }}>
          {pct == null ? "–" : `${up ? "▲" : "▼"} ${fmt(Math.abs(pct))} %`}
        </span>
        {abs != null && <span className="text-muted-foreground">({fmt(abs, 0)})</span>}
        {period != null && <span className="text-muted-foreground">· {period}</span>}
      </p>
    </button>
  )
}

// ---------------------------------------------------------------- differences

interface DifferenceRule {
  slug: string
  label: string
  mode: "max" | "min"
  intensity?: "per_10k_pop"
}

const DIFFERENCE_RULES: DifferenceRule[] = [
  { slug: "pop_growth", label: "höheres Bevölkerungswachstum", mode: "max" },
  { slug: "unemp_rate", label: "niedrigere Arbeitslosenquote", mode: "min" },
  { slug: "unemp", label: "weniger Arbeitslose", mode: "min" },
  { slug: "gdp_pc", label: "höheres BIP je Einwohner", mode: "max" },
  { slug: "housing_permits", label: "mehr Baugenehmigungen", mode: "max", intensity: "per_10k_pop" },
  { slug: "housing_completions", label: "mehr Baufertigstellungen", mode: "max", intensity: "per_10k_pop" },
  { slug: "chargers_per_10k", label: "mehr Ladepunkte je 10.000 Einwohner", mode: "max" },
  { slug: "traffic_accidents", label: "weniger Verkehrsunfälle", mode: "min" },
]

function Differences({ regionIds }: { regionIds: string[] }) {
  const profiles = useQuery({
    queryKey: ["profiles", [...regionIds].sort().join(",")],
    queryFn: async () => {
      const entries = await Promise.all(regionIds.map(async (id) => [id, await fetchRegionProfile(id)] as const))
      return Object.fromEntries(entries)
    },
  })

  const bullets = useMemo(() => {
    const profs = profiles.data
    if (!profs) return []
    const map = new Map(regionIds.map((id) => [id, profs[id]]))
    const kpis = (id: string) => (map.get(id)?.kpis ?? []) as Insight[]
    const insights = regionIds.map((id) => kpis(id))
    const allHave = (slug: string) => insights.every((list) => list.some((k) => k.slug === slug && k.value != null))
    const pop = (id: string) => kpis(id).find((k) => k.slug === "pop_total")?.value

    const out: { name: string; winnerId: string; text: string }[] = []
    for (const rule of DIFFERENCE_RULES) {
      if (!allHave(rule.slug)) continue
      const values = new Map<string, number>()
      for (const id of regionIds) {
        const k = kpis(id).find((x) => x.slug === rule.slug)
        let v = k?.value ?? NaN
        if (rule.intensity === "per_10k_pop") {
          const p = pop(id)
          if (!p) continue
          v = (v / p) * 10_000
        }
        if (Number.isFinite(v)) values.set(id, v)
      }
      if (values.size < 2) continue
      const sorted = [...values.entries()].sort((a, b) =>
        rule.mode === "max" ? b[1] - a[1] : a[1] - b[1],
      )
      const winnerId = sorted[0][0]
      const loserId = sorted[1][0]
      const wV = sorted[0][1]
      const lV = sorted[1][1]
      const unit = rule.intensity === "per_10k_pop" ? "je 10 000 Einw." : kpis(winnerId).find((x) => x.slug === rule.slug)!.unit
      out.push({
        name: rule.label,
        winnerId,
        text: `${map.get(winnerId)!.region.name}: ${fmt(wV)}${unit ? ` ${unit}` : ""} – ${map.get(loserId)!.region.name}: ${fmt(lV)}${unit ? ` ${unit}` : ""}`,
      })
    }
    return out.slice(0, 6)
  }, [profiles.data, regionIds])

  if (profiles.isPending) return <LoadingState label="Unterschiede werden berechnet …" />
  if (profiles.isError) return null

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-lg font-semibold tracking-tight">Wesentliche Unterschiede</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
        Automatisch aus dem Snapshot abgeleitete Einzelvergleiche – bewusst ohne Gesamtwertung.
      </p>
      <ul className="max-w-3xl space-y-2.5 text-sm">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />
            <span>
              <span className="font-medium">{b.name}:</span> {b.text}
            </span>
          </li>
        ))}
      </ul>
      {bullets.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Jede Zeile betrachtet genau einen Indikator. Eine Region kann bei einem Indikator anders abschneiden als bei einem
          anderen – aus dieser Liste lässt sich kein pauschales „besser“ ableiten.
        </p>
      )}
    </section>
  )
}