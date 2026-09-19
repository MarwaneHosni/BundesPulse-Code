import { useMemo, type ReactNode } from "react"
import { DataTable } from "@/components/data-table"
import { ErrorState } from "@/components/async-state"
import { Kpi } from "@/components/kpi"
import { PageHeader } from "@/components/page-header"
import { useMetadata } from "@/lib/queries"

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE")
}

export function MethodologyPage() {
  const meta = useMetadata()
  const sources = useMemo(() => meta.data?.sources ?? [], [meta.data])
  const indicators = useMemo(() => meta.data?.indicators ?? [], [meta.data])

  const byCategory = useMemo(() => {
    const groups = new Map<string, typeof indicators>()
    for (const ind of indicators) {
      const list = groups.get(ind.category) ?? []
      list.push(ind)
      groups.set(ind.category, list)
    }
    return Array.from(groups.entries())
  }, [indicators])

  const levels = useMemo(
    () =>
      Object.fromEntries(
        Array.from(
          new Set<string>(indicators.flatMap((i) => i.levels)),
        ).map((l) => [
          l,
          l === "bund" ? "Bund" : l === "bundesland" ? "Bundesländer" : "Kreise",
        ]),
      ),
    [indicators],
  )

  return (
    <div className="container py-8">
      <PageHeader
        title="Methodik & Quellen"
        eyebrow="Transparenz"
        description="Woher die Zahlen kommen, wie sie berechnet werden und worauf sie nicht hindeuten."
      />

      <div className="mb-10 flex flex-wrap gap-10">
        {meta.data && (
          <>
            <Kpi label="Indikatoren" value={meta.data.indicators.length} deltaSuffix="" />
            <Kpi label="Quellen" value={meta.data.sources.length} deltaSuffix="" />
            <Kpi label="Snapshot erstellt" value={fmtDate(meta.data.snapshot.built_at_utc ?? "")} deltaSuffix="" />
          </>
        )}
      </div>

      {/* concept overview */}
      <section className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <MethodBlock title="Quellen">
          <p>
            Alle Werte stammen aus offiziellen, frei verfügbaren Daten — Statistisches Bundesamt (Destatis),
            Arbeitskreis VGR der Länder, Bundesagentur für Arbeit, Bundesnetzagentur und Umweltbundesamt. Die
            Daten werden einmalig in einen unveränderlichen Snapshot überführt; die Webanwendung liest nur noch
            diesen Snapshot und ruft zur Laufzeit keine externen Dienste ab.
          </p>
          <p className="mt-2">
            Zu jeder Ansicht gehört ein Quellen-Hinweis: im Region-Profil („Quellen“), in der Datenexplorer
            („Quelle“) und unter den Diagrammen.
          </p>
        </MethodBlock>

        <MethodBlock title="Indikatoren">
          <p>
            Jeder Indikator hat einen eindeutigen Schlüssel (Slug), eine Kategorie, eine Einheit und eine
            räumliche Ebene (Bund, Bundesländer, Kreise). Einige Indikatoren werden aus Rohzahlen abgeleitet
            (z. B. Arbeitslosenquote, BIP je Einwohner, Ladepunkte je 10 000 Einwohner).
          </p>
        </MethodBlock>

        <MethodBlock title="Prozentuale Veränderung">
          <p>
            Die jährliche Veränderung wird als relative Änderung berechnet:</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Δ % = (Wert(g) − Wert(g−1)) / |Wert(g−1)| × 100
          </p>
          <p className="mt-2">
            Für Anteile (z. B. Arbeitslosenquote) wird zusätzlich die absolute Differenz in Prozentpunkten
            angezeigt, weil relative Veränderungen hier irreführend wären.
          </p>
        </MethodBlock>

        <MethodBlock title="Normalisierung">
          <p>
            Für bessere Vergleichbarkeit zwischen unterschiedlich großen Regionen werden Kennzahlen pro Kopf
            gebildet: BIP je Einwohner, Ladepunkte je 10 000 Einwohner, Baugenehmigungen je 10 000 Einwohner.
            Diese Intensitäten sind direkt zwischen Regionen vergleichbar; absolute Summen (z. B. Einwohner)
            werden nur als solche dargestellt.
          </p>
        </MethodBlock>

        <MethodBlock title="Rang & Perzentil">
          <p>
            Pro Indikator, Jahr und Ebene werden alle Regionen nach Wert sortiert. Rang 1 ist dabei immer der
            größte bzw. kleinste Wert je nach Richtung (für Arbeitslosenquote: kleinster Wert = Rang 1). Das
            Perzentil gibt an, wie viel Prozent der Regionen auf demselben oder einem besseren Niveau liegen.
          </p>
        </MethodBlock>

        <MethodBlock title="Korrelation">
          <p>
            Für zwei Indikatoren auf derselben Ebene berechnen wir den Pearson-Koeffizienten (linearer
            Zusammenhang) und den Spearman-Koeffizienten (Rang-Zusammenhang). Werte zwischen −1 und +1: nahe 1
            bedeutet gleichläufig, nahe −1 gegenläufig, nahe 0 keinen linearen Zusammenhang. Korrelation
            beschreibt nur eine statistische Assoziation – sie begründet keine Kausalität.
          </p>
        </MethodBlock>

        <MethodBlock title="Umwelt – Aggregation">
          <p>
            Luftgütedaten (NO₂, PM10) werden vom Umweltbundesamt als Messstationen mit Koordinaten bereitgestellt.
            Die Stationen werden den Bundesländern über ihren Standort zugeordnet und der Jahresmittelwert je Land
            aus den Monatsmittelwerten der zugehörigen Stationen aggregiert.
          </p>
        </MethodBlock>

        <MethodBlock title="Grenzen / Einschränkungen">
          <ul className="list-inside list-disc space-y-1">
            <li>Die Luftgüte-Indikatoren enthalten derzeit keine verwertbaren Werte (API nicht zugänglich).</li>
            <li>Beschäftigung, Bau und Ladepunkte liegen nur für ein Jahr vor (kein Vorjahresvergleich).</li>
            <li>Arbeitslosendaten existieren nur auf Kreisebene, Beschäftigung nur auf Länderebene.</li>
            <li>Bevölkerungsdaten für Regionen umfassen 2022–2024 (Zensus-2022-Basis).</li>
            <li>Ränge können sich durch fehlende Regionen eines Jahres leicht verschieben.</li>
            <li>Beim BIP je Einwohner 2025 sind einzelne Länderwerte ggf. unvollständig.</li>
          </ul>
        </MethodBlock>
      </section>

      {/* indicator definitions from real data */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-lg font-semibold tracking-tight">Indikator-Definitionen</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
          Alle Indikatoren im Snapshot – mit Schlüssel, Ebene, Einheit und Datenzeitraum.
        </p>
        {meta.isError ? (
          <ErrorState message={String(meta.error?.message ?? "Fehler")} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {byCategory.map(([category, list]) => (
              <div key={category}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{category}</h3>
                <DataTable
                  columns={[
                    { key: "name", header: "Indikator" },
                    { key: "levels", header: "Ebene", render: (i) => (i.levels ?? []).map((l) => levels[l] ?? l).join(", ") },
                    { key: "unit", header: "Einheit", align: "right" },
                    {
                      key: "range",
                      header: "Jahre",
                      align: "right",
                      render: (i) => (i.first_period == null ? "–" : `${i.first_period}–${i.latest_period}`),
                    },
                  ]}
                  rows={list}
                  rowKey={(i) => i.slug}
                  dense
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* source register from real data */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-lg font-semibold tracking-tight">Quellenregister</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
          Die zugrunde liegenden, offiziellen Datenbestände des Snapshots.
        </p>
        <DataTable
          columns={[
            { key: "provider", header: "Anbieter", render: (s) => <span className="font-medium">{s.provider}</span> },
            { key: "dataset", header: "Datensatz" },
            { key: "retrieval_date", header: "Stand", align: "right", render: (s) => (s.retrieval_date ? fmtDate(s.retrieval_date) : "–") },
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
          Detailliertere Beschreibungen der Datenintegration: <span className="font-medium">docs/data-sources.md</span> ·
          Methodik & Produktspezifikation: <span className="font-medium">docs/product-spec.md</span>.
        </p>
      </section>
    </div>
  )
}

function MethodBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t pt-4">
      <h3 className="mb-2 text-sm font-semibold tracking-tight">{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}