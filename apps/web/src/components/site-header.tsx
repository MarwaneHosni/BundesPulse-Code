import { Link } from "react-router-dom"
import { useHealth } from "@/lib/queries"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { label: string; to: string }[] = [
  { label: "Explore", to: "/explore" },
  { label: "Region", to: "/region/DE1" },
  { label: "Compare", to: "/compare" },
  { label: "Rankings", to: "/rankings" },
  { label: "Data Explorer", to: "/explorer" },
  { label: "Relationships", to: "/relationships" },
  { label: "Methodology", to: "/methodology" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-primary">▮</span>
          BundesPulse
        </a>
        <nav className="hidden gap-1 md:flex" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <BackendStatus />
        </div>
      </div>
    </header>
  )
}

function BackendStatus() {
  const { data, isPending, isError } = useHealth()

  const label = isPending
    ? "API …"
    : isError
      ? "API offline"
      : data?.status === "ok"
        ? "API verbunden"
        : "API degraded"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isPending && "border-border text-muted-foreground",
        isError && "border-destructive/40 text-destructive",
        !isPending && !isError && data?.status === "ok" && "border-green-600/40 text-green-700",
        !isPending && !isError && data?.status !== "ok" && "border-amber-500/40 text-amber-600",
      )}
      role="status"
      title={data?.snapshot?.configured ? `Snapshot: ${data.snapshot.path}` : "Kein Snapshot konfiguriert"}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}