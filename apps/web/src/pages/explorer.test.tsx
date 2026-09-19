import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExplorerPage } from "@/pages/explorer"
import type { RegionGeoJson } from "@/lib/api"

vi.mock("@/lib/queries", () => ({
  useIndicators: () => ({
    data: [
      { indicator_id: 1, slug: "pop_total", name: "Bevölkerungsstand", category: "Demography", unit: "persons", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1990, latest_period: 2024, observation_count: 67, regions_with_data: 17, source_ids: [1, 2] },
      { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
    ],
    isPending: false,
    isError: false,
  }),
  useIndicatorPeriods: () => ({ data: { indicator: "pop_total", level: "bundesland", periods: [2024, 2023] }, isPending: false, isError: false }),
  useRankings: () => ({
    data: {
      indicator: "pop_total",
      period: 2024,
      level: "bundesland",
      count: 2,
      entries: [
        { rank: 1, region_id: "02", name: "Hamburg", type: "bundesland", value: 900000, percentile: 100 },
        { rank: 2, region_id: "09", name: "Bayern", type: "bundesland", value: 13248928, percentile: 93.33 },
      ],
    },
    isPending: false,
    isError: false,
  }),
  useSources: () => ({
    data: [{ source_id: 1, provider: "Statistisches Bundesamt", dataset: "Bevölkerungsfortschreibung", url: "https://example.org/12411", retrieval_date: "2026-08-24" }],
    isPending: false,
    isError: false,
  }),
  useRegionGeoJson: () => ({
    data: {
      type: "FeatureCollection",
      name: "deutschland-regions",
      features: [
        { type: "Feature", properties: { region_id: "02", name: "Hamburg", type: "bundesland", parent_id: "DE", area_km2: 755 }, geometry: null },
        { type: "Feature", properties: { region_id: "09", name: "Bayern", type: "bundesland", parent_id: "DE", area_km2: 70542 }, geometry: null },
      ],
    } as RegionGeoJson,
    isPending: false,
    isError: false,
  }),
}))

function renderExplorer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/explorer"]}>
        <ExplorerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Data Explorer", () => {
  it("shows summary KPIs, table and map", () => {
    renderExplorer()

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument()
    expect(screen.getByText("Regionen")).toBeInTheDocument()
    expect(screen.getByText("Durchschnitt")).toBeInTheDocument()
    expect(screen.getAllByText("Bester Wert").length).toBeGreaterThan(0)

    // table with links
    expect(screen.getByRole("link", { name: "Bayern" })).toHaveAttribute("href", "/region/09")
    // map + source sections
    expect(screen.getByText("Karte")).toBeInTheDocument()
    expect(screen.getAllByText("Quelle").length).toBeGreaterThan(0)
    expect(screen.getByText("Statistisches Bundesamt")).toBeInTheDocument()
  })

  it("offers a CSV download button and level-aware indicators", () => {
    renderExplorer()

    expect(screen.getByRole("button", { name: /CSV herunterladen/ })).toBeInTheDocument()
    // kreis-only indicator hidden at Bundesland level
    expect(screen.queryByRole("option", { name: "Arbeitslosenquote" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Bevölkerungsstand" })).toBeInTheDocument()
  })
})