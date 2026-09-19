import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useMemo, useRef } from "react"
import type { RegionGeoJson } from "@/lib/api"

/**
 * Sequential gold→red ramp (schwarz–rot–gold). Light = low, deep = high. Also
 * used by the legend so both stay perfectly in sync (single source of truth).
 */
const RAMP = [
  "#fff7d6",
  "#fce999",
  "#f7d24a",
  "#e8a200",
  "#d3601c",
  "#c1121f",
  "#7a0008",
]

/** Color for features without an observation. */
const NO_DATA_FILL = "#cfcfcf"

/** minimal structural type for the GeoJSON payload MapLibre accepts */
interface GeoJsonLike {
  type: string
  name?: string
  crs?: unknown
  features: Array<{
    id?: number
    type: string
    properties: Record<string, unknown>
    geometry?: unknown
  }>
}

export interface RegionDatum {
  value: number | null
  rank: number | null
}

interface RegionsMapProps {
  geojson: RegionGeoJson
  /** region_id -> datum. Missing entries render as "keine Daten". */
  data: Record<string, RegionDatum>
  unit?: string
  /** total number of ranked regions (for "Rang x von y" in the tooltip). */
  rankTotal?: number
  onSelect?: (regionId: string) => void
}

interface TooltipDatum {
  name: string
  value: number | null
  rank: number | null
}

export function RegionsMap({
  geojson,
  data,
  unit,
  rankTotal,
  onSelect,
}: RegionsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const hoverIdRef = useRef<number | undefined>(undefined)

  const values = useMemo<number[]>(() => {
    const out: number[] = []
    for (const d of Object.values(data)) {
      if (d.value != null && Number.isFinite(d.value)) out.push(d.value)
    }
    return out
  }, [data])
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1

  const featureData = useMemo<GeoJsonLike>(() => {
    const features = geojson.features.map((f, i) => {
      const datum = data[f.properties.region_id]
      return {
        id: i,
        type: f.type ?? "Feature",
        properties: {
          ...f.properties,
          value: datum?.value != null && Number.isFinite(datum.value) ? datum.value : null,
          rank: datum?.rank ?? null,
        },
        geometry: f.geometry,
      }
    })
    return { type: "FeatureCollection", name: "deutschland-regions", features }
  }, [geojson, data])

  const fillColorExpression = useMemo(() => {
    const steps: (string | number)[] = []
    for (let i = 0; i < RAMP.length; i++) {
      steps.push(i === 0 ? min : min + ((max - min) * i) / (RAMP.length - 1))
      steps.push(RAMP[i])
    }
    return [
      "case",
      ["==", ["get", "value"], null],
      NO_DATA_FILL,
      ["interpolate", ["linear"], ["get", "value"], ...steps],
    ]
  }, [min, max])

  const style = useMemo(
    () =>
      ({
        version: 8,
        sources: {
          regions: { type: "geojson", data: featureData },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "rgba(0,0,0,0)" } },
          {
            id: "regions-fill",
            type: "fill",
            source: "regions",
            paint: {
              "fill-color": fillColorExpression,
              "fill-outline-color": "rgba(255,255,255,0.85)",
              "fill-opacity": 0.95,
            },
          },
          {
            id: "regions-hover",
            type: "fill",
            source: "regions",
            paint: {
              "fill-color": "#000000",
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.18,
                0,
              ],
            },
          },
          {
            id: "regions-outline",
            type: "line",
            source: "regions",
            paint: { "line-color": "rgba(255,255,255,0.9)", "line-width": 0.75 },
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
      maxBounds: [
        [5.0, 46.5],
        [15.8, 55.5],
      ],
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    mapRef.current = map

    const clearHover = () => {
      if (hoverIdRef.current !== undefined) {
        map.removeFeatureState({ source: "regions", id: hoverIdRef.current })
        hoverIdRef.current = undefined
      }
    }

    map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["regions-fill"] })
      map.getCanvas().style.cursor = features.length ? "pointer" : ""
      if (features.length) {
        const f = features[0]
        const props = f.properties as Partial<TooltipDatum>
        const fid = typeof f.id === "number" ? f.id : undefined
        if (fid !== hoverIdRef.current) {
          clearHover()
          if (fid != null) {
            map.setFeatureState({ source: "regions", id: fid }, { hover: true })
            hoverIdRef.current = fid
          }
        }
        if (!popupRef.current) popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 8, className: "bp-popup" })
        popupRef.current.setLngLat(e.lngLat).setHTML(tooltipHtml(props, unit, rankTotal)).addTo(map)
      } else {
        clearHover()
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
      }
    })
    map.on("mouseleave", "regions-fill", () => {
      map.getCanvas().style.cursor = ""
      clearHover()
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
    })
    map.on("click", "regions-fill", (e: maplibregl.MapLayerMouseEvent) => {
      const props = e.features?.[0]?.properties as { region_id?: string } | undefined
      if (props?.region_id && onSelect) onSelect(props.region_id)
    })
    map.on("load", () => {
      const bounds = computeBounds(featureData as GeoJsonLike)
      if (bounds) map.fitBounds(bounds, { padding: 28, duration: 0 })
    })

    return () => {
      clearHover()
      map.remove()
      mapRef.current = null
      popupRef.current = null
    }
    // initial mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const source = map.getSource("regions")
      if (source && "setData" in source) {
        ;(source as { setData(data: unknown): void }).setData(featureData)
      }
      map.setPaintProperty("regions-fill", "fill-color", fillColorExpression as never)
    }
    if (map.isStyleLoaded()) apply()
    else map.once("load", apply)
  }, [featureData, fillColorExpression])

  return <div ref={containerRef} className="h-[360px] w-full overflow-hidden rounded-md border bg-muted sm:h-[440px] lg:h-[540px]" />
}

function tooltipHtml(
  props: Partial<TooltipDatum> & { id?: number },
  unit?: string,
  rankTotal?: number,
): string {
  const name = escapeHtml(props.name ?? "Region")
  const value = props.value
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `<strong>${name}</strong><br/><span>Keine Daten</span>`
  }
  const unitPart = unit ? ` ${unit}` : ""
  const rankPart =
    props.rank != null && rankTotal != null
      ? `<br/><span class="bp-popup-rank">Rang ${props.rank} von ${rankTotal}</span>`
      : ""
  return `<strong>${name}</strong><br/><span>${formatNum(value)}${unitPart}</span>${rankPart}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function computeBounds(features: GeoJsonLike): [[number, number], [number, number]] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const f of features.features) {
    const coords = (f.geometry as { coordinates?: unknown } | undefined)?.coordinates
    if (!coords) continue
    for (const ring of flattenCoords(coords)) {
      if (ring[0] < west) west = ring[0]
      if (ring[1] < south) south = ring[1]
      if (ring[0] > east) east = ring[0]
      if (ring[1] > north) north = ring[1]
    }
  }
  if (!Number.isFinite(west)) return null
  return [
    [west, south],
    [east, north],
  ]
}

function flattenCoords(coords: unknown): Array<[number, number]> {
  if (Array.isArray(coords) && typeof coords[0] === "number") return [coords as [number, number]]
  if (Array.isArray(coords)) {
    const out: Array<[number, number]> = []
    for (const c of coords) out.push(...flattenCoords(c))
    return out
  }
  return []
}

function formatNum(v: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: v < 100 ? 1 : 0 }).format(v)
}

export function MapLegend({
  unit,
  min,
  max,
  hasMissing,
  missingCount,
}: {
  unit?: string
  min: number
  max: number
  hasMissing?: boolean
  missingCount?: number
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div className="min-w-52 flex-1">
        <div className="flex h-2 w-full overflow-hidden rounded-sm">
          {RAMP.map((c) => (
            <div key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs tabular-nums text-muted-foreground">
          <span>{formatNum(min)}</span>
          {unit && <span className="truncate">{unit}</span>}
          <span>{formatNum(max)}</span>
        </div>
      </div>
      {hasMissing && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-3 rounded-[3px] border border-border"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #cfcfcf 0 2px, #e6e6e6 2px 4px)",
            }}
          />
          keine Daten{missingCount != null ? ` (${missingCount})` : ""}
        </div>
      )}
    </div>
  )
}