import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RelationshipsPage } from "@/pages/relationships"

vi.mock("@/lib/queries", () => ({
  useIndicators: () => ({
    data: [
      { indicator_id: 2, slug: "pop_growth", name: "Bevölkerungswachstum", category: "Demography", unit: "percent", description: null, raw_or_derived: "derived", levels: ["bund", "bundesland"], first_period: 1990, latest_period: 2024, observation_count: 66, regions_with_data: 17, source_ids: [1] },
      { indicator_id: 12, slug: "gdp_pc", name: "BIP je Einwohner", category: "Economy", unit: "EUR", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1991, latest_period: 2025, observation_count: 560, regions_with_data: 16, source_ids: [1001] },
      { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
      { indicator_id: 7, slug: "unemp", name: "Arbeitslose", category: "Employment", unit: "persons", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
    ],
    isPending: false,
    isError: false,
  }),
  useIndicatorPeriods: (slug: unknown, level: unknown) => ({
    data: { indicator: String(slug), level: String(level), periods: level === "kreis" ? [2025] : [2024, 2023] },
    isPending: false,
    isError: false,
  }),
  useCorrelation: () => ({
    data: {
      x: "pop_growth",
      y: "gdp_pc",
      level: "bundesland",
      period: 2024,
      n: 15,
      pearson: 0.61913,
      spearman: 0.726526,
      points: [
        { region_id: "09", name: "Bayern", value_x: 0.6, value_y: 62200.38 },
        { region_id: "02", name: "Hamburg", value_x: 0.7, value_y: 90208.32 },
      ],
      note: "Correlation describes association and does not establish causation.",
    },
    isPending: false,
    isError: false,
  }),
}))

function renderRelationships() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/relationships"]}>
        <RelationshipsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Relationship Explorer", () => {
  it("shows X/Y controls, correlation KPIs, region count and the causation note", () => {
    renderRelationships()

    expect(screen.getByRole("heading", { name: "Relationships" })).toBeInTheDocument()
    expect(screen.getByText("Indikator X")).toBeInTheDocument()
    expect(screen.getByText("Indikator Y")).toBeInTheDocument()
    expect(screen.getAllByText("Jahr").length).toBeGreaterThan(0)

    expect(screen.getByText("Pearson r")).toBeInTheDocument()
    expect(screen.getByText("0,62")).toBeInTheDocument()
    expect(screen.getByText("Spearman ρ")).toBeInTheDocument()
    expect(screen.getAllByText("0,73").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Regionen").length).toBeGreaterThan(0)
    expect(screen.getAllByText("15").length).toBeGreaterThan(0)

    // required note in German
    expect(screen.getByText(/beschreibt einen Zusammenhang, sie begründet keine Kausalität/)).toBeInTheDocument()
    // hover/click hint
    expect(screen.getByText(/Punkt anklicken/)).toBeInTheDocument()
  })

  it("offers a period selector and level-aware indicators", () => {
    renderRelationships()

    // period option from the common years
    expect(screen.getByRole("option", { name: "2024" })).toBeInTheDocument()
    // kreis-only indicators are not offered on the Bundesland level
    expect(screen.queryByRole("option", { name: "Arbeitslosenquote" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("option", { name: "Bevölkerungswachstum" }).length).toBeGreaterThan(0)
  })
})