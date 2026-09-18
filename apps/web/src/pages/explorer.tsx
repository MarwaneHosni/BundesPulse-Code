import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/async-state"
import { DataTable } from "@/components/data-table"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useIndicators, useIndicatorPeriods, useRankings } from "@/lib/queries"

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })

export function ExplorerPage() {
  const [indicator, setIndicator] = useState("pop_total")
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [period, setPeriod] = useState<number | undefined>(undefined)
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [limit, setLimit] = useState(50)

  const indicators = useIndicators()
  const periods = useIndicatorPeriods(indicator, level)
  const effectivePeriod = period ?? periods.data?.periods[0]
  const ranking = useRankings(indicator, { level, order, period: effectivePeriod, limit })
  const chartIndicator = useRankings(indicator, { level, order, limit: 20, period: effectivePeriod })

  const indicatorMeta = indicators.data?.find((i) => i.slug === indicator)
  const entries = ranking.data?.entries ?? []

  const chartOption = useMemo(() => {
    const top = chartIndicator.data?.entries.slice(0, 20) ?? []
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: top.map((e) => e.name).reverse() },
      series: [
        {
          type: "bar",
          data: top.map((e) => e.value).reverse(),
          itemStyle: { color: "#2a5f9c" },
          label: { show: true, position: "right", formatter: (p: { value: number }) => fmtN.format(p.value) },
        },
      ],
    }
  }, [chartIndicator.data])

  return (
    <div className="container py-8">
      <PageHeader
        title="Data"
        eyebrow="Datentabelle"
        description="Indikator × Ebene × Jahr – alle Regionen als Tabelle und Überblick (nur aus dem Snapshot)."
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
          <Segmented
            value={level}
            onChange={(l) => { setLevel(l); setPeriod(undefined) }}
            options={[
              { value: "bundesland", label: "Bundesländer" },
              { value: "kreis", label: "Kreise" },
            ]}
          />
        </FilterField>
        <FilterField label="Jahr">
          <Select value={String(effectivePeriod ?? "")} onChange={(e) => setPeriod(Number(e.target.value))}>
            {(periods.data?.periods ?? []).map((p) => (
              <option key={p} value={String(p)}>{p}</option>
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
            {[50, 200, 500].map((n) => (
              <option key={n} value={String(n)}>{n}</option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <p className="mb-4 text-sm text-muted-foreground">
        {indicatorMeta ? `${indicatorMeta.name} · ${indicatorMeta.unit ?? ""}` : ""}
        {ranking.data ? ` · ${ranking.data.count} Regionen (Stand ${ranking.data.period})` : ""}
      </p>

      {ranking.isPending ? (
        <LoadingState label="Daten werden geladen …" />
      ) : ranking.isError ? (
        <ErrorState message={String(ranking.error?.message ?? "Fehler")} />
      ) : ranking.data.count === 0 ? (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Dieser Indikator liegt auf Ebene „{level}“ nicht vor.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <DataTable
            columns={[
              { key: "rank", header: order === "desc" ? "Rang (hoch)" : "Rang (niedrig)" },
              { key: "name", header: "Region", render: (e) => <Link className="hover:underline" to={`/region/${e.region_id}`}>{e.name}</Link> },
              { key: "value", header: "Wert", align: "right", render: (e) => fmtN.format(e.value) },
              { key: "percentile", header: "Perzentil", align: "right", render: (e) => (e.percentile === null ? "–" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(e.percentile)) },
            ]}
            rows={entries}
            rowKey={(e) => e.region_id}
          />
          <aside className="lg:border-l lg:pl-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Top {Math.min(20, chartIndicator.data?.entries.length ?? 0)}</h2>
            {(chartIndicator.data?.entries.length ?? 0) > 0 && (
              <EChart option={chartOption} height={Math.min(20, chartIndicator.data?.entries.length ?? 0) * 22 + 40} />
            )}
            <SourceNote />
          </aside>
        </div>
      )}
    </div>
  )
}