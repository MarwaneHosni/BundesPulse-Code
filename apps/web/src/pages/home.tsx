import { Link } from "react-router-dom"
import {
  Award,
  CalendarDays,
  CalendarRange,
  Database,
  LineChart,
  Map as MapIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  const bund = all.filter((r) => r.type === "bund").length

  const inds = indicators.data ?? []
  const byCategory = (() => {
    const m = new Map<string, number>()
    for (const i of inds) m.set(i.category, (m.get(i.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  })()
  const topCategories = byCategory.slice(0, 6)
  const maxCategory = topCategories.length ? topCategories[0][1] : 1

  const firstPeriods = inds.map((i) => i.first_period).filter((v): v is number => v != null)
  const latestPeriods = inds.map((i) => i.latest_period).filter((v): v is number => v != null)
  const fromYear = firstPeriods.length ? Math.min(...firstPeriods) : null
  const toYear = latestPeriods.length ? Math.max(...latestPeriods) : null

  const providers = [...new Set((meta.data?.sources ?? []).map((s) => s.provider))]

  const entries = ranking.data?.entries ?? []
  const maxV = entries.length ? Math.max(...entries.map((e) => e.value)) : 0
  const minV = entries.length ? Math.min(...entries.map((e) => e.value)) : 0
  const barPct = (v: number) => (maxV === minV ? 100 : 12 + ((maxV - v) / (maxV - minV)) * 88)

  return (
    <div className="container py-8">
      {/* hero */}
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

      {/* bento showcase */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* Regionen */}
        <div className="col-span-2 rounded-3xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <MapIcon className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Regionen</span>
          </div>
          <p className="mt-4 text-[30px] font-semibold leading-[34px] tabular-nums tracking-tight">
            {regions.data?.length ?? "–"}
            <span className="ml-1 text-base font-normal text-muted-foreground">gesamt</span>
          </p>
          <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${(laender / (all.length || 1)) * 100}%` }}
            />
            <div
              className="h-full bg-primary/35"
              style={{ width: `${(kreise / (all.length || 1)) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {bund > 0 && (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                {bund} Bund
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {laender} Bundesländer
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary/35" aria-hidden="true" />
              {kreise} Kreise
            </span>
          </div>
        </div>

        {/* Indikatoren by category */}
        <div className="col-span-2 rounded-3xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <LineChart className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Indikatoren</span>
          </div>
          <p className="mt-4 text-[30px] font-semibold leading-[34px] tabular-nums tracking-tight">
            {indicators.data?.length ?? "–"}
            <span className="ml-1 text-base font-normal text-muted-foreground">gesamt</span>
          </p>
          <ul className="mt-5 space-y-2.5">
            {topCategories.map(([category, n]) => (
              <li key={category} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 truncate text-muted-foreground">{category}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(n / maxCategory) * 100}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Zeitraum */}
        <div className="col-span-1 rounded-3xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <CalendarRange className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Zeitraum</span>
          </div>
          <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">
            {fromYear ?? "–"}–{toYear ?? "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Jahre im Snapshot</p>
        </div>

        {/* Quellen */}
        <div className="col-span-1 rounded-3xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <Database className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Quellen</span>
          </div>
          <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">
            {meta.data?.sources.length ?? "–"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {providers.slice(0, 3).map((p) => (
              <span
                key={p}
                className="max-w-full truncate rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {p}
              </span>
            ))}
            {providers.length > 3 && (
              <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                +{providers.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Snapshot */}
        <div className="col-span-2 rounded-3xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <CalendarDays className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Snapshot</span>
          </div>
          <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">
            {meta.data?.snapshot.built_at_utc
              ? new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")
              : "–"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">unveränderlicher Datenstand</p>
        </div>

        {/* Beste Arbeitsmärkte */}
        <Card className="col-span-2 rounded-3xl lg:col-span-3">
          <CardHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <Award className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Beste Arbeitsmärkte</CardTitle>
              <CardDescription>niedrigste Arbeitslosenquote (Kreise)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {ranking.isError && (
              <p className="text-sm text-destructive">
                Rankings nicht verfügbar: {String(ranking.error).slice(0, 80)}
              </p>
            )}
            <ol className="space-y-1 text-sm">
              {entries.map((e) => (
                <li
                  key={e.region_id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-muted/60"
                >
                  <Link
                    to={`/region/${e.region_id}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                      {e.rank}
                    </span>
                    <span className="truncate font-medium">{e.name}</span>
                  </Link>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${barPct(e.value)}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                    {fmt(e.value)} %
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Indikatoren (real) */}
        <Card className="col-span-2 overflow-hidden rounded-3xl lg:col-span-3">
          <CardHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <LineChart className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Indikatoren (real)</CardTitle>
              <CardDescription>alle Indikatoren im vorbereiteten Snapshot</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto p-0 px-5 pb-5 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Indikator</th>
                  <th className="pb-2 font-medium">Kategorie</th>
                  <th className="pb-2 text-right font-medium">letztes Jahr</th>
                  <th className="pb-2 text-right font-medium">Werte</th>
                </tr>
              </thead>
              <tbody>
                {inds.map((ind) => (
                  <tr key={ind.slug} className="border-t transition-colors hover:bg-muted/50">
                    <td className="py-2 font-medium">{ind.name}</td>
                    <td className="py-2">
                      <Badge variant="secondary" className="rounded-full">
                        {ind.category}
                      </Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">{ind.latest_period ?? "–"}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(ind.observation_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <p className="mt-6 max-w-[70ch] text-sm text-muted-foreground">
        Alle Darstellungen lesen ausschließlich den vorbereiteten DuckDB-Snapshot — gemessen in
        wenigen Millisekunden, ohne externe Abfragen zur Laufzeit.
      </p>
    </div>
  )
}
