import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoadingState({ label }: { label?: string }) {
  return (
    <div aria-busy="true" className="space-y-3 py-2">
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-t pt-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="size-4" /> Daten nicht verfügbar
      </p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          <RefreshCw className="mr-1 size-3.5" /> Erneut versuchen
        </Button>
      )}
    </div>
  )
}