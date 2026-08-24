import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useHealth } from "@/lib/queries"

export function MethodologyPage() {
  const { data, isPending, isError } = useHealth()

  return (
    <div className="container py-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">
          FOUNDATION · product-spec.md §9.7 / §13 · /methodology
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Methodik &amp; Quellen
        </h1>
        <p className="mt-2 text-muted-foreground">
          Vertrauens-Ebene: Quellenregister, Indikator-Methodik,
          Maßnahmen-Systematik, geografische und statistische Methodik sowie
          Snapshot-Manifest.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot-Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isPending && <p>Lade Backend-Status …</p>}
            {isError && (
              <p>
                Backend nicht erreichbar. Starte die API mit{" "}
                <code>npm run dev:api</code>.
              </p>
            )}
            {data && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="font-medium">Service</dt>
                <dd>{data.service} v{data.version}</dd>
                <dt className="font-medium">Status</dt>
                <dd>{data.status}</dd>
                <dt className="font-medium">Snapshot</dt>
                <dd>
                  {data.snapshot.configured
                    ? data.snapshot.path
                    : "Kein Snapshot konfiguriert (Data-Build ausstehend)"}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Methodik vor Bereitstellung</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Das vollständige Quellenregister und die Indikator-Methodik werden
              mit der Data-Build-Phase erstellt und hier veröffentlicht
              (product-spec.md §12–§13).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}