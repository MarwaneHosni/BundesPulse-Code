import { cn } from "@/lib/utils"

interface KpiProps {
  label: string
  value?: number | string | null
  unit?: string
  delta?: number | null
  deltaSuffix?: string
  hint?: string
}

function fmtNum(n: number, digits = 2): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(n)
}

/**
 * A single headline number. Deliberately restrained: one value, one label,
 * an optional small delta. No card chrome.
 */
export function Kpi({ label, value, unit, delta, deltaSuffix = "%", hint }: KpiProps) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">
          {value === null || value === undefined ? "–" : typeof value === "number" ? fmtNum(value) : value}
          {unit && <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>}
        </span>
        {hasDelta && (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              delta! > 0 ? "text-emerald-600" : delta! < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {delta! > 0 ? "▲" : delta! < 0 ? "▼" : ""} {fmtNum(Math.abs(delta!))}
            {deltaSuffix}
          </span>
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}