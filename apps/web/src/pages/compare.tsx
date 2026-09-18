import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state"
import { DataTable } from "@/components/data-table"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Select } from "@/components/filters"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useCompare, useIndicators, useRegions } from "@/lib/queries"
import { cn } from "@/lib/utils"

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })

export function ComparePage() {
  const [indicator, setIndicator] = useState("gdp_pc")
  const [selected, setSelected] = useState<string[]>(["09", "08"])

  const indicators = useIndicators()
  const regions = useRegions("bundesland")
  const compare = useCompare(selected, indicator)

  const toggle = (id: string) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((r) => r !== id) : cur.length >= 4 ? cur : [...cur, id],
    )
  }

  const option = useMemo(() => {
    const series = compare.data?.regions ?? []
    const periods = Array.from(new Set(series.flatMap((r) => r.series.map((p) => p.period)))).sort()
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "line" } },
      legend: { bottom: 0, icon: "roundRect", itemWidth: 12, itemHeight: 3 },
      grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
      xAxis: { type: "category", data: periods, name: "Jahr" },
      yAxis: { type: "value", scale: true },
      series: series.map((r) => ({
        name: r.name,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        data: periods.map((p) => r.series.find((s) => s.period === p)?.value ?? null),
        lineStyle: { width: 2 },
      })),
      color: ["#2a5f9c", "#6b9ece", "#c2410c", "#5b8c5a"],
    }
  }, [compare.data])

  const latestRows = useMemo(
    () =>
      (compare.data?.regions ?? []).map((r) => {
        const last = r.series[r.series.length - 1]
        return { region_id: r.region_id, name: r.name, value: last?.value ?? null, series: last }
      }),
    [compare.data],
  )

  return (
    <div className="container py-8">
      <PageHeader
        title="Compare"
        eyebrow="Vergleich"
        description="2–4 Regionen für einen Indikator – synchronisierte Zeitreihen aus dem Snapshot."
        actions={
          <span className="text-sm text-muted-foreground">„Wer führt, und um wie viel?“</span>
        }
      />

      <FilterBar>
        <FilterField label="Indikator">
          <Select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {(indicators.data ?? []).map((i) => (
              <option key={i.slug} value={i.slug}>{i.name}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Bundesländer (bis zu 4)">
          <div className="flex max-w-2xl flex-wrap gap-1.5">
            {(regions.data ?? []).map((r) => (
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
        </FilterField>
      </FilterBar>

      {selected.length === 0 && <EmptyState title="Bitte mindestens eine Region wählen." />}

      {selected.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {compare.isError && (
              <ErrorState message={String(compare.error?.message ?? "Fehler")} />
            )}
            {compare.isPending ? (
              <LoadingState label="Vergleich wird geladen …" />
            ) : (
              <EChart option={option} height={420} />
            )}
            <div className="mt-4">
              <Link
                to={`/region/${selected[0] ?? ""}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Zur Region-Übersicht ↗
              </Link>
            </div>
            <SourceNote />
          </div>

          <aside className="lg:border-l lg:pl-6">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Letzter Stand</h2>
            <DataTable
              columns={[
                { key: "name", header: "Region" },
                { key: "value", header: "Wert", align: "right", render: (r) => fmtN.format(r.value ?? 0) },
                {
                  key: "delta",
                  header: "Δ Jahr",
                  align: "right",
                  render: (r) =>
                    r.series?.percentage_change === null || r.series?.percentage_change === undefined
                      ? "–"
                      : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(r.series.percentage_change)} %`,
                },
              ]}
              rows={latestRows}
              rowKey={(r) => r.region_id}
            />
          </aside>
        </div>
      )}
    </div>
  )
}