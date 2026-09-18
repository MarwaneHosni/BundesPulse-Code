import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/async-state"
import { DataTable } from "@/components/data-table"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useIndicators, useIndicatorPeriods, useRankings } from "@/lib/queries"

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })

export function RankingsPage() {
  const [indicator, setIndicator] = useState("gdp_pc")
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [order, setOrder] = useState<"desc" | "asc">("desc")
  const [period, setPeriod] = useState<number | undefined>(undefined)
  const [limit, setLimit] = useState(20)

  const indicators = useIndicators()
  const periods = useIndicatorPeriods(indicator, level)
  const effectivePeriod = period ?? periods.data?.periods[0]
  const ranking = useRankings(indicator, { level, order, period: effectivePeriod, limit })

  const indicatorMeta = indicators.data?.find((i) => i.slug === indicator)
  const entries = useMemo(() => ranking.data?.entries ?? [], [ranking.data])

  const chartOption = useMemo(() => {
    const top = entries.slice(0, 20)
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: top.map((e) => e.name).reverse() },
      series: [
        {
          type: "bar",
          data: top
            .map((e) => ({ value: e.value, name: e.name }))
            .reverse(),
          itemStyle: { color: "#2a5f9c" },
          label: {
            show: true,
            position: "right",
            formatter: (p: { value: number }) => fmtN.format(p.value),
          },
        },
      ],
    }
  }, [entries])

  return (
    <div className="container py-8">
      <PageHeader
        title="Rankings"
        eyebrow="Rangliste"
        description="Regionale Reihenfolge für einen Indikator – Rang und Perzentil je Region."
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
            {(periods.data?.periods ?? []).map((p) => (
              <option key={p} value={String(p)}>{p}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Zeilen">
          <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            {[20, 50, 100, 200].map((n) => (
              <option key={n} value={String(n)}>{n}</option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="mb-6 flex flex-wrap gap-10">
        <Kpi label="Regionen" value={ranking.data?.count ?? null} unit="mit Daten" />
        {entries[0] && (
          <Kpi
            label="Platz 1"
            value={entries[0].value}
            unit={indicatorMeta?.unit}
            hint={entries[0].name}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {ranking.isPending ? (
            <LoadingState label="Ranking wird geladen …" />
          ) : ranking.isError ? (
            <ErrorState message={String(ranking.error?.message ?? "Fehler")} />
          ) : (
            <DataTable
              columns={[
                { key: "rank", header: "Rang" },
                { key: "name", header: "Region", render: (e) => <Link className="hover:underline" to={`/region/${e.region_id}`}>{e.name}</Link> },
                { key: "value", header: "Wert", align: "right", render: (e) => fmtN.format(e.value) },
                {
                  key: "percentile",
                  header: "Perzentil",
                  align: "right",
                  render: (e) => (e.percentile === null ? "–" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(e.percentile)}`),
                },
              ]}
              rows={entries}
              rowKey={(e) => e.region_id}
              dense
            />
          )}
          <SourceNote />
        </div>
        <div className="lg:border-l lg:pl-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Top {Math.min(20, entries.length)}</h2>
          {entries.length > 0 && <EChart option={chartOption} height={Math.min(20, entries.length) * 22 + 40} />}
        </div>
      </div>
    </div>
  )
}