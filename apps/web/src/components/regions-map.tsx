import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useMemo, useRef } from "react"
import type { RegionGeoJson } from "@/lib/api"

const RAMP = [
  "#eef4fb",
  "#cfe1f3",
  "#aecde9",
  "#8ab6dd",
  "#6499cb",
  "#417bb5",
  "#2a5f9c",
  "#123f73",
]

/** minimal structural type for the GeoJSON payload MapLibre accepts */
interface GeoJsonLike {
  type: string
  name?: string
  crs?: unknown
  features: Array<Record<string, unknown>>
}

interface RegionsMapProps {
  geojson: RegionGeoJson
  values: Record<string, number>
  unit?: string
  onSelect?: (regionId: string) => void
}

export function RegionsMap({ geojson, values, unit, onSelect }: RegionsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const numeric = useMemo(() => Object.values(values).filter((v) => Number.isFinite(v)), [values])
  const min = numeric.length ? Math.min(...numeric) : 0
  const max = numeric.length ? Math.max(...numeric) : 1

  const featureData = useMemo<GeoJsonLike>(() => {
    const features = geojson.features.map((f) => ({
      ...f,
      properties: { ...f.properties, value: (() => {
        const value = values[f.properties.region_id]
        return value !== undefined && Number.isFinite(value) ? value : null
      })() },
    }))
    return { type: "FeatureCollection", name: "deutschland-regions", features }
  }, [geojson, values])

  const fillColorExpression = useMemo(() => {
    const steps: (string | number)[] = []
    for (let i = 0; i < RAMP.length; i++) {
      steps.push(i === 0 ? min : min + ((max - min) * i) / (RAMP.length - 1))
      steps.push(RAMP[i])
    }
    return [
      "case",
      ["==", ["get", "value"], null],
      "#e8ebee",
      ["interpolate", ["linear"], ["get", "value"], ...steps],
    ]
  }, [min, max])

  const style = useMemo(
    () =>
      ({
        version: 8,
        sources: { regions: { type: "geojson", data: featureData } },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#f4f5f7" } },
          {
            id: "regions-fill",
            type: "fill",
            source: "regions",
            paint: {
              "fill-color": fillColorExpression,
              "fill-outline-color": "#ffffff",
              "fill-opacity": 0.95,
            },
          },
          {
            id: "regions-outline",
            type: "line",
            source: "regions",
            paint: { "line-color": "#ffffff", "line-width": 0.5 },
          },
        ],
      }) as never,
    [featureData, fillColorExpression],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [10.4, 51.1],
      zoom: 4.6,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    mapRef.current = map

    map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["regions-fill"] })
      map.getCanvas().style.cursor = features.length ? "pointer" : ""
      if (features.length) {
        const props = features[0].properties as { name?: string; value?: number | null }
        if (!popupRef.current) popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 6 })
        const valuePart = props.value === undefined || props.value === null
          ? "keine Daten"
          : `${formatNum(props.value)}${unit ? ` ${unit}` : ""}`
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${props.name ?? ""}</strong><br/>${valuePart}`)
          .addTo(map)
      } else if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
    })
    map.on("mouseleave", "regions-fill", () => {
      map.getCanvas().style.cursor = ""
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
    })
    map.on("click", "regions-fill", (e: maplibregl.MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as { region_id?: string } | undefined
      if (props?.region_id && onSelect) onSelect(props.region_id)
    })

    return () => {
      map.remove()
      mapRef.current = null
      popupRef.current = null
    }
    // initial mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource("regions")
    if (source && "setData" in source) {
      ;(source as { setData(data: unknown): void }).setData(featureData)
    }
    map.setPaintProperty("regions-fill", "fill-color", fillColorExpression as never)
  }, [featureData, fillColorExpression])

  return <div ref={containerRef} className="h-[520px] w-full overflow-hidden rounded-md border" />
}

function formatNum(v: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: v < 100 ? 1 : 0 }).format(v)
}

export function MapLegend({ unit, min, max }: { unit?: string; min: number; max: number }) {
  return (
    <div className="mt-2">
      <div className="flex h-2 w-full overflow-hidden rounded-sm">
        {RAMP.map((c) => (
          <div key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatNum(min)}</span>
        <span className="text-muted-foreground">{unit ?? ""}</span>
        <span>{formatNum(max)}</span>
      </div>
    </div>
  )
}