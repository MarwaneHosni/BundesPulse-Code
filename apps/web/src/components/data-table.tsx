import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  align?: "left" | "right"
  render?: (row: T, index: number) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyLabel?: string
  dense?: boolean
}

const td = "px-3 py-2 text-sm tabular-nums"
const th = cn(td, "font-medium text-muted-foreground border-b whitespace-nowrap")

export function DataTable<T>({ columns, rows, rowKey, emptyLabel, dense }: DataTableProps<T>) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn(th, col.align === "right" && "text-right")}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={cn(td, "py-8 text-center text-muted-foreground")}>
                {emptyLabel ?? "Keine Daten für diese Auswahl."}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/40">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(td, dense ? "py-1.5" : "", col.align === "right" && "text-right")}
                >
                  {col.render ? col.render(row, i) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}