import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RankingsPage } from "@/pages/rankings"
import type { RegionGeoJson } from "@/lib/api"

vi.mock("@/lib/queries", () => ({
  useIndicators: () => ({
    data: [
      { indicator_id: 12, slug: "gdp_pc", name: "BIP je Einwohner", category: "Economy", unit: "EUR", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1991, latest_period: 2025, observation_count: 560, regions_with_data: 16, source_ids: [1001] },
      { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
      { indicator_id: 9, slug: "no2", name: "Stickstoffdioxid", category: "Umwelt", unit: "µg/m³", description: null, raw_or_derived: "raw", levels: [], first_period: null, latest_period: null, observation_count: 0, regions_with_data: 0, source_ids: [] },
    ],
    isPending: false,
    isError: false,
  }),
  useIndicatorPeriods: () => ({ data: { indicator: "gdp_pc", level: "bundesland", periods: [2025, 2024] }, isPending: false, isError: false }),
  useRankings: (slug: unknown, opts: { level?: string }) => {
    const kreis = opts?.level === "kreis"
    const entries = kreis
      ? [{ rank: 1, region_id: "09162", name: "München, Landeshauptstadt", type: "kreis", value: 5.3, percentile: 100 }]
      : [
          { rank: 1, region_id: "02", name: "Hamburg", type: "bundesland", value: 90208.32, percentile: 100 },
          { rank: 2, region_id: "09", name: "Bayern", type: "bundesland", value: 62200.38, percentile: 93.33 },
        ]
    return {
      data: { indicator: String(slug), period: 2025, level: kreis ? "kreis" : "bundesland", count: entries.length, entries },
      isPending: false,
      isError: false,
    }
  },
  useRegionGeoJson: () => ({
    data: {
      type: "FeatureCollection",
      name: "deutschland-regions",
      features: [
        { type: "Feature", properties: { region_id: "02", name: "Hamburg", type: "bundesland", parent_id: "DE", area_km2: 755 }, geometry: null },
        { type: "Feature", properties: { region_id: "09", name: "Bayern", type: "bundesland", parent_id: "DE", area_km2: 70542 }, geometry: null },
        { type: "Feature", properties: { region_id: "09162", name: "München, Landeshauptstadt", type: "kreis", parent_id: "09", area_km2: 310 }, geometry: null },
      ],
    } as RegionGeoJson,
    isPending: false,
    isError: false,
  }),
}))

function renderRankings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/rankings"]}>
        <RankingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Rankings page", () => {
  it("shows rank, region, value and the map at Bundesland level", () => {
    renderRankings()

    expect(screen.getByRole("heading", { name: "Rankings" })).toBeInTheDocument()
    // KPI row
    expect(screen.getByText("Regionen")).toBeInTheDocument()
    expect(screen.getByText("Platz 1")).toBeInTheDocument()

    // table with rank, region links, values
    expect(screen.getByRole("link", { name: "Bayern" })).toHaveAttribute("href", "/region/09")
    expect(screen.getByRole("link", { name: "Hamburg" })).toHaveAttribute("href", "/region/02")
    expect(screen.getAllByText(/^90.208,3$/).length).toBeGreaterThan(0)

    // map section
    expect(screen.getByText("Karte")).toBeInTheDocument()
  })

  it("offers only indicators relevant for the level", () => {
    renderRankings()

    expect(screen.getByRole("option", { name: "BIP je Einwohner" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Arbeitslosenquote" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Stickstoffdioxid" })).not.toBeInTheDocument()
  })

  it("switches to Kreis level and reflects the new ranking", async () => {
    const user = userEvent.setup()
    renderRankings()

    await user.click(screen.getByRole("button", { name: "Kreise" }))

    expect(screen.getByRole("link", { name: "München, Landeshauptstadt" })).toHaveAttribute("href", "/region/09162")
  })
})