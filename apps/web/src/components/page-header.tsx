import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {eyebrow && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[26px] font-semibold leading-8 tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="mt-2 max-w-[72ch] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  )
}