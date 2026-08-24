import { useEffect, useRef } from "react"
import * as echarts from "echarts/core"
import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const DOMAINS = [
  "Demography",
  "Employment",
  "Economy",
  "Housing",
  "Mobility",
  "Environment",
  "Infrastructure",
]

/**
 * Illustrative placeholder using Apache ECharts.
 *
 * Shows the seven v1 indicator groups. The values are deliberately synthetic
 * (1..7) and are NOT real data — real indicator values ship with the prepared
 * snapshot in a later phase.
 */
export function DomainsChart() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", minInterval: 1 },
      yAxis: { type: "category", data: DOMAINS },
      series: [
        {
          type: "bar",
          data: DOMAINS.map((_, i) => i + 1),
          itemStyle: { color: "hsl(var(--primary))" },
          label: { show: true, position: "right" },
        },
      ],
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sieben Handlungsfelder (v1)</CardTitle>
        <CardDescription>
          Apache ECharts — illustrative Platzhalter, keine echten Daten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="h-72 w-full" role="img" aria-label="Balkendiagramm der sieben Fachdomänen (Platzhalter)" />
      </CardContent>
    </Card>
  )
}