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
import { PageHeader } from "@/components/page-header"
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
      <PageHeader
        title="Deutschland Digital Monitor"
        description="Offene Regionaldaten für Deutschland: Bund, Bundesländer und Landkreise / kreisfreie Städte — erkunden, vergleichen, einordnen."
        actions={
          <Button asChild size="lg">
            <Link to="/explore">Deutschlandkarte öffnen</Link>
          </Button>
        }
      />

      <section className="mb-10 flex flex-wrap gap-x-12 gap-y-6">
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
        <Kpi label="Indikatoren" value={indicators.data?.length ?? null} deltaSuffix="" />
        <Kpi label="Quellen" value={meta.data?.sources.length ?? null} deltaSuffix="" />
        {meta.data?.snapshot.built_at_utc && (
          <Kpi
            label="Snapshot"
            value={new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")}
            deltaSuffix=""
          />
        )}
      </section>

      <section className="grid gap-10 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Indikatoren (real)</CardTitle>
            <CardDescription>alle Indikatoren im vorbereiteten Snapshot</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto p-0 px-6 pb-6">
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
                    <td className="py-1.5 font-medium">{ind.name}</td>
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

        <div className="flex flex-col gap-6">
          <Card className="shadow-none">
            <CardHeader>
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
                  <li key={e.region_id} className="flex items-center justify-between border-t py-1.5">
                    <Link to={`/region/${e.region_id}`} className="font-medium hover:underline">
                      {e.rank}. {e.name}
                    </Link>
                    <span>{fmt(e.value)} %</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            Alle Darstellungen lesen ausschließlich den vorbereiteten DuckDB-Snapshot —
            gemessen in wenigen Millisekunden, ohne externe Abfragen zur Laufzeit.
          </p>
        </div>
      </section>
    </div>
  )
}