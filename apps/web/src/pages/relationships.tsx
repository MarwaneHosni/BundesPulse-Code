import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/async-state"
import { EChart } from "@/components/echart"
import { FilterBar, FilterField, Segmented, Select } from "@/components/filters"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { SourceNote } from "@/components/source-note"
import { useCorrelation, useIndicators, useIndicatorPeriods } from "@/lib/queries"

const LEVEL_DEFAULTS: Record<string, [string, string]> = {
  bundesland: ["pop_growth", "gdp_pc"],
  kreis: ["unemp_rate", "unemp"],
}

const fmtN = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 })

export function RelationshipsPage() {
  const navigate = useNavigate()
  const [x, setX] = useState(LEVEL_DEFAULTS.bundesland[0])
  const [y, setY] = useState(LEVEL_DEFAULTS.bundesland[1])
  const [level, setLevel] = useState<"bundesland" | "kreis">("bundesland")
  const [period, setPeriod] = useState<number | undefined>(undefined)

  const indicators = useIndicators()
  const available = useMemo(
    () => (indicators.data ?? []).filter((i) => i.levels.includes(level)),
    [indicators.data, level],
  )

  const effectiveX =
    available.some((i) => i.slug === x) ? x : (available.find((i) => i.slug === LEVEL_DEFAULTS[level][0])?.slug ?? available[0]?.slug ?? "")
  const effectiveY =
    available.some((i) => i.slug === y) ? y : (available.find((i) => i.slug === LEVEL_DEFAULTS[level][1])?.slug ?? available.find((i) => i.slug !== effectiveX)?.slug ?? "")

  const xPeriods = useIndicatorPeriods(effectiveX, level)
  const yPeriods = useIndicatorPeriods(effectiveY, level)

  const commonPeriods = useMemo(() => {
    const xp = new Set(xPeriods.data?.periods ?? [])
    return (yPeriods.data?.periods ?? []).filter((p) => xp.has(p)).sort((a, b) => b - a)
  }, [xPeriods.data, yPeriods.data])

  const effectivePeriod = period !== undefined && commonPeriods.includes(period) ? period : commonPeriods[0]

  useEffect(() => {
    setPeriod(undefined)
  }, [effectiveX, effectiveY, level])

  const corr = useCorrelation(effectiveX, effectiveY, { level, period: effectivePeriod })

  const xMeta = available.find((i) => i.slug === effectiveX)
  const yMeta = available.find((i) => i.slug === effectiveY)

  const points = useMemo(
    () => (corr.data?.points ?? []).filter((p) => p.value_x !== null && p.value_y !== null),
    [corr.data],
  )

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (p: { name: string; value: [number, number] }) =>
          `<strong>${p.name}</strong><br/>${xMeta?.name ?? effectiveX}: ${fmtN.format(p.value[0])}${xMeta?.unit ? ` ${xMeta.unit}` : ""}<br/>${yMeta?.name ?? effectiveY}: ${fmtN.format(p.value[1])}${yMeta?.unit ? ` ${yMeta.unit}` : ""}`,
      },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        name: xMeta?.name ?? effectiveX,
        scale: true,
        nameLocation: "middle" as const,
        nameGap: 24,
        axisLabel: { formatter: (v: number) => new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v) },
      },
      yAxis: {
        type: "value",
        name: yMeta?.name ?? effectiveY,
        scale: true,
        axisLabel: { formatter: (v: number) => new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v) },
      },
      series: [
        {
          type: "scatter",
          symbolSize: points.length > 60 ? 6 : 10,
          itemStyle: { color: "#8C1418", opacity: 0.85 },
          data: points.map((p) => ({
            name: p.name,
            regionId: p.region_id,
            value: [p.value_x as number, p.value_y as number],
          })),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "rgba(120,104,80,0.5)", type: "dashed" as const },
            data: [
              { type: "average", name: "Mittel (x)" },
              { type: "average", name: "Mittel (y)", valueIndex: 1 },
            ],
          },
        },
      ],
    }
  }, [points, effectiveX, effectiveY, xMeta, yMeta])

  return (
    <div className="container py-8">
      <PageHeader
        title="Relationships"
        eyebrow="Zusammenhänge"
        description="Zwei Indikatoren auf einer Ebene: Streudiagramm, Korrelation und Regionenzahl – aus dem Snapshot."
      />

      <FilterBar>
        <FilterField label="Indikator X">
          <Select
            value={effectiveX}
            onChange={(e) => setX(e.target.value)}
            className="max-w-60"
          >
            {available.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Indikator Y">
          <Select
            value={effectiveY}
            onChange={(e) => setY(e.target.value)}
            className="max-w-60"
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
            onChange={(l) => setLevel(l)}
            options={[
              { value: "bundesland", label: "Bundesländer" },
              { value: "kreis", label: "Kreise" },
            ]}
          />
        </FilterField>
        <FilterField label="Jahr">
          <Select
            value={String(effectivePeriod ?? "")}
            onChange={(e) => setPeriod(Number(e.target.value))}
            disabled={commonPeriods.length === 0}
          >
            {(commonPeriods.length === 0 ? [null] : commonPeriods).map((p) => (
              <option key={String(p)} value={String(p ?? "")}>
                {p ?? "keine gemeinsamen Jahre"}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {corr.isError && <ErrorState message={String(corr.error?.message ?? "Fehler")} />}

      {corr.isPending ? (
        <LoadingState label="Zusammenhänge werden berechnet …" />
      ) : corr.data && corr.data.n === 0 ? (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Für diese Auswahl liegen keine gemeinsamen Daten vor (keine Region mit beiden Werten).
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-10">
            <Kpi label="Pearson r" value={corr.data?.pearson ?? null} deltaSuffix="" />
            <Kpi label="Spearman ρ" value={corr.data?.spearman ?? null} deltaSuffix="" />
            <Kpi label="Regionen" value={corr.data?.n ?? null} unit="Regionen" />
            <Kpi label="Jahr" value={corr.data?.period ?? null} deltaSuffix="" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <EChart
              option={option}
              height={480}
              onClick={(params) => {
                const id = params?.data?.regionId
                if (id) navigate(`/region/${id}`)
              }}
            />
            <aside className="lg:border-l lg:pl-6">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Hinweis</h2>
              <p className="text-sm text-muted-foreground">
                Korrelation beschreibt einen Zusammenhang, sie begründet keine Kausalität.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {corr.data?.n ?? 0} Regionen mit beiden Werten ({corr.data?.period ?? "–"}).
                {corr.data?.n !== undefined && corr.data.n > 2
                  ? " Der Pearson-Koeffizient misst linearen Zusammenhang."
                  : ""}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Punkt anklicken, um das Region-Profil zu öffnen.
              </p>
              <SourceNote />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}