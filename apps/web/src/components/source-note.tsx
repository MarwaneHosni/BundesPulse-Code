import { ExternalLink } from "lucide-react"
import type { Source } from "@/lib/api"

/**
 * Small, muted provenance footnote shown under tables/charts.
 */
export function SourceNote({ source, label }: { source?: Source | null; label?: string }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {label && <>{label} · </>}
      {source ? (
        <>
          <span className="font-medium">{source.provider}</span>
          {source.dataset && <> — {source.dataset}</>}
          {source.retrieval_date && <> · Stand {source.retrieval_date}</>}
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 text-foreground/70 underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
            >
              Quelle <ExternalLink className="size-3" />
            </a>
          )}
        </>
      ) : (
        "Bereitgestellt aus dem vorbereiteten, unveränderlichen Datensnapshot."
      )}
    </p>
  )
}