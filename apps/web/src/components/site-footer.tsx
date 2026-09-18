import { Link } from "react-router-dom"
import { useHealth } from "@/lib/queries"

const LINKS = [
  { label: "Explore", to: "/explore" },
  { label: "Compare", to: "/compare" },
  { label: "Rankings", to: "/rankings" },
  { label: "Data", to: "/explorer" },
  { label: "Relationships", to: "/relationships" },
  { label: "Methodik & Quellen", to: "/methodology" },
]

export function SiteFooter() {
  const { data } = useHealth()
  const snapshotLabel = data
    ? data.snapshot.configured
      ? "Snapshot konfiguriert"
      : "Kein Snapshot (Data-Build ausstehend)"
    : "Backend nicht erreichbar"

  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col gap-4 text-sm text-muted-foreground">
        <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Footer-Navigation">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p>
          Deutschland Digital Monitor — {data?.version ?? "…"} · {snapshotLabel}
        </p>
        <p className="max-w-2xl text-xs">
          Read-only Plattform über einen vorbereiteten, unveränderlichen
          Datensnapshot. Keine Nutzerkonten, keine Uploads, keine
          Laufzeit-Datenerfassung.
        </p>
      </div>
    </footer>
  )
}