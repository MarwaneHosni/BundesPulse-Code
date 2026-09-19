import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/filters"
import { useRegions } from "@/lib/queries"
import type { Region } from "@/lib/api"
import { cn } from "@/lib/utils"

interface RegionNavigationProps {
  regionId: string
  onChange: (regionId: string) => void
  className?: string
}

/** Order regions by name with a deterministic numeric-ish AGS tiebreak. */
function sortRegions(regions: Region[]): Region[] {
  return [...regions].sort((a, b) => a.name.localeCompare(b.name, "de") || a.region_id.localeCompare(b.region_id))
}

export function RegionNavigation({ regionId, onChange, className }: RegionNavigationProps) {
  const regions = useRegions()

  const groups = useMemo(() => {
    const all = regions.data ?? []
    const bundeslaender = sortRegions(all.filter((r) => r.type === "bundesland"))
    const kreise = sortRegions(all.filter((r) => r.type === "kreis"))
    const bund = all.find((r) => r.type === "bund")
    return {
      bund: bund ? [{ id: bund.region_id, name: bund.name }] : [],
      bundeslaender: bundeslaender.map((r) => ({ id: r.region_id, name: r.name })),
      kreise: kreise.map((r) => ({ id: r.region_id, name: r.name })),
    }
  }, [regions.data])

  const current = useMemo(
    () => regions.data?.find((r) => r.region_id === regionId),
    [regions.data, regionId],
  )

  const currentType = current?.type

  const cycleList = useMemo(() => {
    if (currentType === "bundesland") return groups.bundeslaender
    if (currentType === "kreis") {
      // cycle through the kreise of the same parent Bundesland
      const parent = current?.parent_id
      const kids = groups.kreise.filter(
        (k) => regions.data?.find((r) => r.region_id === k.id)?.parent_id === parent,
      )
      return kids.length ? kids : groups.kreise
    }
    if (currentType === "bund") return groups.bund
    return []
  }, [current, currentType, groups, regions.data])

  const step = (delta: number) => {
    if (!cycleList.length) return
    const idx = cycleList.findIndex((r) => r.id === regionId)
    if (idx === -1) return
    const next = cycleList[(idx + delta + cycleList.length) % cycleList.length]
    onChange(next.id)
  }

  const hasPrev = currentType === "bund" || (cycleList.length > 1 && cycleList.findIndex((r) => r.id === regionId) > 0)
  const hasNext = currentType === "bund" || (cycleList.length > 1 && cycleList.findIndex((r) => r.id === regionId) < cycleList.length - 1)

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Vorherige Region"
        disabled={!hasPrev}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Select value={current?.region_id ?? ""} onChange={(e) => onChange(e.target.value)} className="min-w-56">
        {groups.bund.length > 0 && (
          <optgroup label="Bund">
            {groups.bund.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Bundesländer">
          {groups.bundeslaender.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Kreise & kreisfreie Städte">
          {groups.kreise.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </optgroup>
      </Select>
      <Button
        variant="outline"
        size="icon"
        aria-label="Nächste Region"
        disabled={!hasNext}
        onClick={() => step(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}