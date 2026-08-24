import { ViewScaffold } from "@/components/view-scaffold"

export function RelationshipsPage() {
  return (
    <ViewScaffold
      title="Relationship Explorer"
      specRef="product-spec.md §9.6 · /relationships"
      description="Streudiagramm für Indikator X ↔ Y, Korrelation mit explizitem Hinweis: Korrelation ist keine Kausalität."
    />
  )
}