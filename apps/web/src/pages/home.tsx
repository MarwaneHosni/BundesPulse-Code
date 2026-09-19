import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Kpi } from "@/components/kpi"
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

      {/* stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border bg-card p-5 transition-colors hover:border-primary/30">
          <Kpi
            label="Regionen"
            value={regions.data?.length ?? null}
            unit="gesamt"
            hint={
              regions.data
                ? `${regions.data.filter((r) => r.type === "bundesland").length} Länder · ${
                    regions.data.filter((r) => r.type === "kreis").length
                  } Kreise`
                : undefined
            }
          />
        </div>
        <div className="rounded-3xl border bg-card p-5 transition-colors hover:border-primary/30">
          <Kpi label="Indikatoren" value={indicators.data?.length ?? null} deltaSuffix="" />
        </div>
        <div className="rounded-3xl border bg-card p-5 transition-colors hover:border-primary/30">
          <Kpi label="Quellen" value={meta.data?.sources.length ?? null} deltaSuffix="" />
        </div>
        {meta.data?.snapshot.built_at_utc && (
          <div className="rounded-3xl border bg-card p-5 transition-colors hover:border-primary/30">
            <Kpi
              label="Snapshot"
              value={new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")}
              deltaSuffix=""
            />
          </div>
        )}
      </section>

      {/* content */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-[1.75rem]">
          <CardHeader className="pb-3">
            <CardTitle>Indikatoren (real)</CardTitle>
            <CardDescription>alle Indikatoren im vorbereiteten Snapshot</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto p-0 px-6 pb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Indikator</th>
                  <th className="pb-2 font-medium">Kategorie</th>
                  <th className="pb-2 text-right font-medium">letztes Jahr</th>
                  <th className="pb-2 text-right font-medium">Werte</th>
                </tr>
              </thead>
              <tbody>
                {(indicators.data ?? []).map((ind) => (
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

        <div className="flex flex-col gap-6">
          <Card className="rounded-[1.75rem]">
            <CardHeader className="pb-3">
              <CardTitle>Beste Arbeitsmärkte</CardTitle>
              <CardDescription>niedrigste Arbeitslosenquote (Kreise)</CardDescription>
            </CardHeader>
            <CardContent>
              {ranking.isError && (
                <p className="text-sm text-destructive">
                  Rankings nicht verfügbar: {String(ranking.error).slice(0, 80)}
                </p>
              )}
              <ol className="space-y-1 text-sm">
                {(ranking.data?.entries ?? []).map((e) => (
                  <li
                    key={e.region_id}
                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-muted/60"
                  >
                    <Link to={`/region/${e.region_id}`} className="flex items-center gap-2.5 font-medium">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                      <span>{e.rank}. {e.name}</span>
                    </Link>
                    <span className="tabular-nums text-muted-foreground">{fmt(e.value)} %</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <p className="max-w-[70ch] text-sm text-muted-foreground">
            Alle Darstellungen lesen ausschließlich den vorbereiteten DuckDB-Snapshot —
            gemessen in wenigen Millisekunden, ohne externe Abfragen zur Laufzeit.
          </p>
        </div>
      </section>
    </div>
  )
}
