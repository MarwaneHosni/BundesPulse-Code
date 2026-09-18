import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRegionProfile, useRegionSeries } from "@/lib/queries"

const DEMO_REGION = "09" // Bayern

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(n)
}

export function RegionPage() {
  const profile = useRegionProfile(DEMO_REGION)
  const gdp = useRegionSeries(DEMO_REGION, "gdp_pc")

  const region = profile.data?.region

  return (
    <div className="container py-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">Region Profile · GET /api/regions/{DEMO_REGION}/profile</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {profile.isError ? "Region nicht verfügbar" : region?.name ?? "…"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {region && (
            <>
              <Badge variant="secondary">{region.type}</Badge>{" "}
              <span className="ml-1">
                AGS {region.region_id} · Fläche {fmt(region.area, 1)} km²
              </span>
            </>
          )}
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kennzahlen (letzter Stand)</CardTitle>
            <CardDescription>aus der vorberechneten insights-Tabelle</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            {profile.isError && (
              <p className="text-sm text-destructive">{String(profile.error).slice(0, 120)}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Indikator</th>
                  <th className="pb-2 text-right">Wert</th>
                  <th className="pb-2 text-right">Δ p.p./%</th>
                  <th className="pb-2 text-right">Rang</th>
                </tr>
              </thead>
              <tbody>
                {(profile.data?.kpis ?? []).map((k) => (
                  <tr key={k.slug} className="border-t">
                    <td className="py-1.5">
                      <span className="font-medium">{k.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">{k.unit}</span>
                    </td>
                    <td className="py-1.5 text-right">{fmt(k.value)}</td>
                    <td className="py-1.5 text-right">
                      {k.yoy_pct === null ? "–" : `${fmt(k.yoy_pct)} %`}
                    </td>
                    <td className="py-1.5 text-right">#{k.rank_desc ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BIP je Einwohner — Zeitreihe</CardTitle>
            <CardDescription>GET /api/regions/{DEMO_REGION}/indicators/gdp_pc</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            {gdp.isError && (
              <p className="text-sm text-destructive">{String(gdp.error).slice(0, 120)}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Jahr</th>
                  <th className="pb-2 text-right">€</th>
                  <th className="pb-2 text-right">absolut</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {(gdp.data?.series ?? []).map((p) => (
                  <tr key={p.period} className="border-t">
                    <td className="py-1.5 font-medium">{p.period}</td>
                    <td className="py-1.5 text-right">{fmt(p.value, 1)}</td>
                    <td className="py-1.5 text-right">
                      {p.absolute_change === null ? "–" : fmt(p.absolute_change, 1)}
                    </td>
                    <td className="py-1.5 text-right">
                      {p.percentage_change === null ? "–" : fmt(p.percentage_change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}