import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DomainsChart } from "@/components/domains-chart"
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

  const laender = regions.data?.filter((r) => r.type === "bundesland").length ?? 0
  const kreise = regions.data?.filter((r) => r.type === "kreis").length ?? 0

  return (
    <div className="container py-10">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          Deutschland Digital Monitor
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Offene Regionaldaten für Deutschland: Bund, Bundesländer und
          Landkreise / kreisfreie Städte — erkunden, vergleichen, einordnen.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Regionen</CardTitle>
            <CardDescription>Bund · Bundesländer · Kreise</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {regions.isPending ? "…" : `${fmt(regions.data?.length)} gesamt`}
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              {laender > 0 ? `${laender} Länder · ${kreise} Kreise / kreisfreie Städte` : "nicht verfügbar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indikatoren</CardTitle>
            <CardDescription>7 Fachdomänen</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {indicators.isPending ? "…" : indicators.data?.length}
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              reale Werte aus dem vorbereiteten Snapshot
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quellen</CardTitle>
            <CardDescription>offizielle Datenanbieter</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {meta.isPending ? "…" : meta.data?.sources.length}
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Destatis · BA · BNetzA · VGR · UBA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
            <CardDescription>nur lesbar, unveränderlich</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {meta.data ? (
              <p className="text-muted-foreground">
                {new Date(meta.data.snapshot.built_at_utc).toLocaleString("de-DE")}
              </p>
            ) : (
              <p className="text-muted-foreground">nicht verfügbar</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indikatoren (real)</CardTitle>
            <CardDescription>aus GET /api/indicators</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Indikator</th>
                  <th className="pb-2">Kategorie</th>
                  <th className="pb-2 text-right">letztes Jahr</th>
                  <th className="pb-2 text-right">Werte</th>
                </tr>
              </thead>
              <tbody>
                {(indicators.data ?? []).map((ind) => (
                  <tr key={ind.slug} className="border-t">
                    <td className="py-1.5">
                      <span className="font-medium">{ind.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">({ind.slug})</span>
                    </td>
                    <td className="py-1.5">
                      <Badge variant="secondary">{ind.category}</Badge>
                    </td>
                    <td className="py-1.5 text-right">{ind.latest_period ?? "–"}</td>
                    <td className="py-1.5 text-right">{fmt(ind.observation_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Beste Arbeitsmärkte</CardTitle>
              <CardDescription>
                niedrigste Arbeitslosenquote (Kreise, get /api/rankings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ranking.isError && (
                <p className="text-sm text-destructive">
                  Rankings nicht verfügbar: {String(ranking.error).slice(0, 80)}
                </p>
              )}
              <ol className="space-y-1 text-sm">
                {(ranking.data?.entries ?? []).map((e) => (
                  <li key={e.region_id} className="flex items-center justify-between border-t py-1.5">
                    <span className="font-medium">
                      {e.rank}. {e.name}
                    </span>
                    <span>{fmt(e.value)} %</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <DomainsChart />
        </div>
      </section>
    </div>
  )
}