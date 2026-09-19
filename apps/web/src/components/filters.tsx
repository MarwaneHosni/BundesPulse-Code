import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</label>
  )
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <FilterLabel>{label}</FilterLabel>
      {children}
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 border-b pb-4">{children}</div>
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground",
        "hover:border-muted-foreground/40 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-input bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            "inline-flex h-full items-center rounded-[5px] px-3 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}