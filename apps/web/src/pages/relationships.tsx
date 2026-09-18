import { useMemo, useState } from "react"
import { ErrorState, LoadingState } from "@/components/async-state"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useCorrelation, useIndicators } from "@/lib/queries"

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 })

export function RelationshipsPage() {
  const [x, setX] = useState("pop_growth")
  const [y, setY] = useState("gdp_pc")
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")

  const indicators = useIndicators()
  const corr = useCorrelation(x, y, { level })

  const xMeta = indicators.data?.find((i) => i.slug === x)
  const yMeta = indicators.data?.find((i) => i.slug === y)

  const option = useMemo(() => {
    const points = (corr.data?.points ?? []).filter((p) => p.value_x !== null && p.value_y !== null)
    return {
      tooltip: {
        trigger: "item",
        formatter: (p: { name: string; value: [number, number] }) =>
          `<strong>${p.name}</strong><br/>x: ${fmtN.format(p.value[0])}<br/>y: ${fmtN.format(p.value[1])}`,
      },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        name: xMeta?.name ?? x,
        scale: true,
        nameLocation: "middle",
        nameGap: 22,
      },
      yAxis: { type: "value", name: yMeta?.name ?? y, scale: true },
      series: [
        {
          type: "scatter",
          symbolSize: 9,
          itemStyle: { color: "#2a5f9c", opacity: 0.85 },
          data: points.map((p) => ({
            name: p.name,
            value: [p.value_x as number, p.value_y as number],
          })),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "rgba(64,64,64,0.35)", type: "dashed" },
            data: [{ type: "average", name: "Mittel (x)" }, { type: "average", name: "Mittel (y)", valueIndex: 1 }],
          },
        },
      ],
    }
  }, [corr.data, xMeta, yMeta, x, y])

  return (
    <div className="container py-8">
      <PageHeader
        title="Relationships"
        eyebrow="Zusammenhänge"
        description="Zwei Indikatoren, eine Ebene: Streudiagramm und Korrelation. Korrelation ist keine Kausalität."
      />

      <FilterBar>
        <FilterField label="Indikator X">
          <Select value={x} onChange={(e) => setX(e.target.value)}>
            {(indicators.data ?? []).map((i) => (
              <option key={i.slug} value={i.slug}>{i.name}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Indikator Y">
          <Select value={y} onChange={(e) => setY(e.target.value)}>
            {(indicators.data ?? []).map((i) => (
              <option key={i.slug} value={i.slug}>{i.name}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Ebene">
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: "bundesland", label: "Bundesländer" },
              { value: "kreis", label: "Kreise" },
            ]}
          />
        </FilterField>
      </FilterBar>

      {corr.isError && <ErrorState message={String(corr.error?.message ?? "Fehler")} />}

      {corr.isPending ? (
        <LoadingState label="Zusammenhänge werden berechnet …" />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-10">
            <Kpi label="Pearson r" value={corr.data?.pearson ?? null} deltaSuffix="" />
            <Kpi label="Spearman ρ" value={corr.data?.spearman ?? null} deltaSuffix="" />
            <Kpi label="Regionen" value={corr.data?.n ?? null} unit="n" />
            <Kpi label="Jahr" value={corr.data?.period ?? null} deltaSuffix="" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <EChart option={option} height={460} />
            <aside className="lg:border-l lg:pl-6">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Hinweis</h2>
              <p className="text-sm text-muted-foreground">{corr.data?.note}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {corr.data?.n ?? 0} komplette Regionen-Paare für {corr.data?.period ?? "–"}.
                {corr.data?.n !== undefined && corr.data.n > 2
                  ? " Der Pearson-Koeffizient misst linearen Zusammenhang."
                  : ""}
              </p>
              <SourceNote />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}