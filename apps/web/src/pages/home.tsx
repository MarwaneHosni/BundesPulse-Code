import { Link } from "react-router-dom"
import {
  Award,
  CalendarDays,
  Database,
  LineChart,
  Map as MapIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useIndicators, useMetadata, useRankings, useRegions } from "@/lib/queries"

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n)
}

export function HomePage() {
  const regions = useRegions()
  const indicators = useIndicators()
  const meta = useMetadata()
  const ranking = useRankings("unemp_rate", { level: "kreis", order: "asc", limit: 5 })

  const all = regions.data ?? []
  const laender = all.filter((r) => r.type === "bundesland").length
  const kreise = all.filter((r) => r.type === "kreis").length

  const inds = indicators.data ?? []
  const firstPeriods = inds.map((i) => i.first_period).filter((v): v is number => v != null)
  const latestPeriods = inds.map((i) => i.latest_period).filter((v): v is number => v != null)
  const fromYear = firstPeriods.length ? Math.min(...firstPeriods) : null
  const toYear = latestPeriods.length ? Math.max(...latestPeriods) : null

  const providers = [...new Set((meta.data?.sources ?? []).map((s) => s.provider))]

  const entries = ranking.data?.entries ?? []
  const maxV = entries.length ? Math.max(...entries.map((e) => e.value)) : 0
  const minV = entries.length ? Math.min(...entries.map((e) => e.value)) : 0
  const barPct = (v: number) => (maxV === minV ? 100 : 8 + ((maxV - v) / (maxV - minV)) * 92)

  return (
    <div className="container py-8">
      {/* masthead */}
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-primary/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-muted"
        />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Offene Regionaldaten
          </span>
          <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.75rem]">
            Deutschland Digital Monitor
          </h1>
          <p className="mt-4 max-w-[62ch] text-base leading-7 text-muted-foreground">
            Offene Regionaldaten für Deutschland: Bund, Bundesländer und Landkreise / kreisfreie
            Städte — erkunden, vergleichen, einordnen.
          </p>
          <div className="mt-7">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/explore">Deutschlandkarte öffnen</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* stat ribbon — one band, not a card grid */}
      <section className="mt-6 grid grid-cols-2 divide-y divide-border overflow-hidden rounded-3xl border bg-card sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MapIcon className="size-3.5" aria-hidden="true" />
            Regionen
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-8 tabular-nums tracking-tight">
            {regions.data?.length ?? "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {laender} Länder · {kreise} Kreise
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <LineChart className="size-3.5" aria-hidden="true" />
            Indikatoren
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-8 tabular-nums tracking-tight">
            {indicators.data?.length ?? "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">im Snapshot</p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database className="size-3.5" aria-hidden="true" />
            Quellen
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-8 tabular-nums tracking-tight">
            {meta.data?.sources.length ?? "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">amtliche Anbieter</p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Snapshot
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-8 tabular-nums tracking-tight">
            {meta.data?.snapshot.built_at_utc
              ? new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")
              : "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">unveränderlich</p>
        </div>
      </section>

      {/* feature columns */}
      <section className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-[1.15fr_1fr]">
        {/* labour-market leaderboard — editorial list, no card */}
        <div>
          <div className="flex items-center gap-3 border-b pb-3">
            <Award className="size-4 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Beste Arbeitsmärkte
              </h2>
              <p className="text-xs text-muted-foreground">niedrigste Arbeitslosenquote (Kreise)</p>
            </div>
          </div>
          {ranking.isError && (
            <p className="pt-4 text-sm text-destructive">
              Rankings nicht verfügbar: {String(ranking.error).slice(0, 80)}
            </p>
          )}
          <ol className="mt-1 divide-y divide-border">
            {entries.map((e) => (
              <li
                key={e.region_id}
                className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="w-8 shrink-0 font-display text-xl font-semibold tabular-nums text-muted-foreground">
                  {e.rank}
                </span>
                <Link
                  to={`/region/${e.region_id}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {e.name}
                </Link>
                <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${barPct(e.value)}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                  {fmt(e.value)} %
                </span>
              </li>
            ))}
          </ol>
          {entries.length > 0 && (
            <div className="mt-4">
              <Link
                to="/rankings"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Alle Ranglisten
              </Link>
            </div>
          )}
        </div>

        {/* indicator register */}
        <div>
          <div className="flex items-center gap-3 border-b pb-3">
            <LineChart className="size-4 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Indikatoren (real)
              </h2>
              <p className="text-xs text-muted-foreground">
                alle Indikatoren im vorbereiteten Snapshot
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-[26rem] overflow-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Indikator</th>
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  <th className="px-3 py-2 text-right font-medium">Jahr</th>
                  <th className="px-3 py-2 text-right font-medium">Werte</th>
                </tr>
              </thead>
              <tbody>
                {inds.map((ind) => (
                  <tr key={ind.slug} className="border-t transition-colors hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{ind.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="rounded-full">
                        {ind.category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{ind.latest_period ?? "–"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(ind.observation_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* colophon */}
      <section className="mt-12 border-t pt-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <span>
            Zeitraum{" "}
            <span className="tabular-nums text-foreground">
              {fromYear ?? "–"}–{toYear ?? "–"}
            </span>
          </span>
          <span className="hidden sm:inline">{providers.length} Anbieter</span>
          <div className="flex flex-wrap gap-1.5">
            {providers.map((p) => (
              <span
                key={p}
                className="max-w-full truncate rounded-full border bg-muted/50 px-2 py-0.5 text-[11px]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
          Alle Darstellungen lesen ausschließlich den vorbereiteten DuckDB-Snapshot — gemessen in
          wenigen Millisekunden, ohne externe Abfragen zur Laufzeit.
        </p>
      </section>
    </div>
  )
}
