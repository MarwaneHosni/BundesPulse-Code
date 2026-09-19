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
    chartRef.current?.setOption(option, true)
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