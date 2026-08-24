import { useHealth } from "@/lib/queries"

export function SiteFooter() {
  const { data } = useHealth()
  const snapshotLabel = data
    ? data.snapshot.configured
      ? "Snapshot konfiguriert"
      : "Kein Snapshot (Data-Build ausstehend)"
    : "Backend nicht erreichbar"

  return (
    <footer className="border-t py-6">
      <div className="container flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Deutschland Digital Monitor — {data?.version ?? "…"} · {snapshotLabel}
        </p>
        <p>
          Read-only Plattform über einen vorbereiteten, unveränderlichen
          Datensnapshot. Keine Nutzerkonten, keine Uploads, keine
          Laufzeit-Datenerfassung.
        </p>
      </div>
    </footer>
  )
}