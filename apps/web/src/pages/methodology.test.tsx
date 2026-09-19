import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MethodologyPage } from "@/pages/methodology"

vi.mock("@/lib/queries", () => ({
  useMetadata: () => ({
    data: {
      snapshot: { name: "deutschland", built_at_utc: "2026-09-18T00:00:00Z" },
      indicators: [
        { indicator_id: 1, slug: "pop_total", name: "Bevölkerungsstand", category: "Demography", unit: "persons", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1990, latest_period: 2024, observation_count: 67, regions_with_data: 17, source_ids: [1] },
        { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
      ],
      sources: [{ source_id: 1, provider: "Statistisches Bundesamt", dataset: "Bevölkerungsfortschreibung", url: "https://example.org", retrieval_date: "2026-08-24" }],
    },
    isPending: false,
    isError: false,
  }),
}))

function renderMethodology() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/methodology"]}>
        <MethodologyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Methodology page", () => {
  it("explains the concepts and shows indicator definitions + sources", () => {
    renderMethodology()

    expect(screen.getByRole("heading", { name: "Methodik & Quellen" })).toBeInTheDocument()
    for (const title of ["Indikatoren", "Prozentuale Veränderung", "Normalisierung", "Rang & Perzentil", "Korrelation", "Grenzen / Einschränkungen"]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText(/Quellen/).length).toBeGreaterThan(0)
    // no causal claims
    expect(screen.getByText(/begründet keine Kausalität/)).toBeInTheDocument()

    // real indicator definitions
    expect(screen.getByRole("heading", { name: "Indikator-Definitionen" })).toBeInTheDocument()
    expect(screen.getByText("Bevölkerungsstand")).toBeInTheDocument()
    expect(screen.getByText("Arbeitslosenquote")).toBeInTheDocument()

    // real source register
    expect(screen.getByRole("heading", { name: "Quellenregister" })).toBeInTheDocument()
    expect(screen.getByText("Statistisches Bundesamt")).toBeInTheDocument()
  })
})