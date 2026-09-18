import { DataTable } from "@/components/data-table"
import { ErrorState } from "@/components/async-state"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { useMetadata } from "@/lib/queries"

export function MethodologyPage() {
  const meta = useMetadata()
  const sources = meta.data?.sources ?? []

  return (
    <div className="container py-8">
      <PageHeader
        title="Methodik & Quellen"
        eyebrow="Transparenz"
        description="Woher die Zahlen kommen und wie sie berechnet werden – aus dem vorbereiteten Snapshot."
      />

      <div className="mb-8 flex flex-wrap gap-10">
        {meta.data && (
          <>
            <Kpi label="Indikatoren" value={meta.data.indicators.length} deltaSuffix="" />
            <Kpi label="Quellen" value={meta.data.sources.length} deltaSuffix="" />
            <Kpi label="Snapshot erstellt" value={new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")} deltaSuffix="" />
          </>
        )}
      </div>

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Snapshot</h2>
      {meta.isError ? (
        <ErrorState message={String(meta.error?.message ?? "Fehler")} />
      ) : meta.data ? (
        <table className="mb-8 w-full max-w-2xl text-sm">
          <tbody>
            {Object.entries(meta.data.snapshot).map(([k, v]) => (
              <tr key={k} className="border-b">
                <td className="py-1.5 pr-6 font-medium">{k}</td>
                <td className="py-1.5 text-muted-foreground">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Quellenregister</h2>
      <DataTable
        columns={[
          { key: "provider", header: "Anbieter", render: (s) => <span className="font-medium">{s.provider}</span> },
          { key: "dataset", header: "Datensatz" },
          { key: "retrieval_date", header: "Stand", align: "right" },
          {
            key: "url",
            header: "",
            align: "right",
            render: (s) =>
              s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline decoration-muted-foreground/40 hover:text-foreground">
                  Quelle ↗
                </a>
              ) : null,
          },
        ]}
        rows={sources}
        rowKey={(s) => String(s.source_id)}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Die vollständige Methodik (Maßnahmen-Systematik, Regionen, Statistikmethode) steht in{" "}
        <span className="font-medium">docs/product-spec.md</span> und <span className="font-medium">docs/data-sources.md</span>.
      </p>
    </div>
  )
}