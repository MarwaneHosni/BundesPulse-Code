import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const DOMAINS = [
  "Demography",
  "Employment",
  "Economy",
  "Housing",
  "Mobility",
  "Environment",
  "Infrastructure",
]

export function HomePage() {
  return (
    <div className="container py-12">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          Deutschland Digital Monitor
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Offene Regionaldaten für Deutschland: Bund, Bundesländer und
          Landkreise / kreisfreie Städte — erkunden, vergleichen, einordnen.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Sieben Handlungsfelder (v1)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {DOMAINS.map((domain) => (
            <Card key={domain}>
              <CardHeader>
                <CardTitle>{domain}</CardTitle>
                <CardDescription>
                  Indikator-Katalog laut product-spec.md §6.
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}