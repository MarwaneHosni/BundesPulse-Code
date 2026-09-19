import * as echarts from "echarts/core"
import { BarChart, LineChart, ScatterChart } from "echarts/charts"
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

echarts.use([BarChart, LineChart, ScatterChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer])

type EChartsOption = echarts.EChartsCoreOption

/**
 * Shared visual base for every chart (see docs/DESIGN-PLAN.md §11).
 * Merged after each page's option so page values still win, while axes, grid,
 * legend and tooltips get one coherent, mode-neutral treatment.
 */
const BASE_THEME: EChartsOption = {
  textStyle: {
    fontFamily:
      'ui-sans-serif, "Segoe UI Variable Text", "Segoe UI", Inter, system-ui, -apple-system, sans-serif',
    color: "#595959",
    fontSize: 12,
  },
  color: ["#C1121F", "#E8A200", "#2E6E68", "#7A4A6B", "#2E7D74", "#B5561B", "#6E7A2E", "#111111"],
  grid: { borderColor: "rgba(0,0,0,0.12)" },
  xAxis: {
    axisLine: { lineStyle: { color: "rgba(0,0,0,0.35)" } },
    axisTick: { lineStyle: { color: "rgba(0,0,0,0.35)" } },
    axisLabel: { color: "#595959" },
    splitLine: { lineStyle: { color: "rgba(0,0,0,0.08)" } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: "rgba(0,0,0,0.35)" } },
    axisTick: { lineStyle: { color: "rgba(0,0,0,0.35)" } },
    axisLabel: { color: "#595959" },
    splitLine: { lineStyle: { color: "rgba(0,0,0,0.08)" } },
  },
  legend: { textStyle: { color: "#595959" } },
  tooltip: {
    backgroundColor: "rgba(10,10,10,0.96)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    textStyle: { color: "#f5f5f5" },
  },
}

interface EChartProps {
  option: EChartsOption
  height?: number | string
  className?: string
  /** Subscribe to chart element clicks (scatter points etc.). */
  onClick?: (params: { data: { regionId?: string; name?: string } } & Record<string, unknown>) => void
}

/**
 * Thin wrapper around Apache ECharts: creates the chart once, applies options,
 * resizes with the container, disposes on unmount.
 */
export function EChart({ option, height = 320, className, onClick }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    chart.on("click", (params) => onClickRef.current?.(params as never))
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(option, true)
    // apply shared visual base where the page option doesn't define a value
    chart.setOption(BASE_THEME)
  }, [option])

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label="Diagramm"
    />
  )
}