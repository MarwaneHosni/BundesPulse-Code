import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ComparePage } from "@/pages/compare"
import type { Insight, RegionProfile } from "@/lib/api"

vi.mock("@/lib/queries", () => ({
  useIndicators: () => ({
    data: [
      { indicator_id: 12, slug: "gdp_pc", name: "BIP je Einwohner", category: "Economy", unit: "EUR", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1991, latest_period: 2025, observation_count: 560, regions_with_data: 16, source_ids: [1001] },
      { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
    ],
    isPending: false,
    isError: false,
  }),
  useRegions: () => ({
    data: [
      { region_id: "09", name: "Bayern", type: "bundesland", parent_id: "DE", area: 70592 },
      { region_id: "08", name: "Baden-Württemberg", type: "bundesland", parent_id: "DE", area: 35752 },
    ],
    isPending: false,
    isError: false,
  }),
  useCompare: () => ({
    data: {
      indicator: "gdp_pc",
      regions: [
        {
          region_id: "09",
          name: "Bayern",
          series: [
            { period: 2024, value: 60258.36, absolute_change: 1030, percentage_change: 1.7 },
            { period: 2025, value: 62200.38, absolute_change: 1942.02, percentage_change: 3.2 },
          ],
        },
        {
          region_id: "08",
          name: "Baden-Württemberg",
          series: [
            { period: 2024, value: 57800, absolute_change: -10, percentage_change: -0.02 },
            { period: 2025, value: 59334.88, absolute_change: 1534.88, percentage_change: 2.7 },
          ],
        },
      ],
    },
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    fetchRegionProfile: vi.fn(async (id: string): Promise<RegionProfile> => {
      const insight = (
        slug: string,
        name: string,
        unit: string,
        value: number,
        period: number,
      ): Insight => ({
        indicator_id: 1,
        slug,
        name,
        category: "Economy",
        unit,
        period,
        value,
        previous_value: null,
        previous_period: null,
        yoy_pct: null,
        rank_desc: null,
        rank_asc: null,
        percentile: null,
        vs_de_ratio: null,
        vs_land_ratio: null,
      })
      const base = {
        region: id === "09" ? { region_id: "09", name: "Bayern", type: "bundesland", parent_id: "DE", area: 70592 } : { region_id: "08", name: "Baden-Württemberg", type: "bundesland", parent_id: "DE", area: 35752 },
        kpis:
          id === "09"
            ? [
                insight("pop_total", "Bevölkerungsstand", "persons", 13248928, 2024),
                insight("pop_growth", "Bevölkerungswachstum", "percent", 0.6, 2024),
                insight("gdp_pc", "BIP je Einwohner", "EUR", 62200.38, 2025),
                insight("housing_permits", "Baugenehmigungen", "dwellings", 76000, 2022),
              ]
            : [
                insight("pop_total", "Bevölkerungsstand", "persons", 11000000, 2024),
                insight("pop_growth", "Bevölkerungswachstum", "percent", 0.5, 2024),
                insight("gdp_pc", "BIP je Einwohner", "EUR", 59334.88, 2025),
                insight("housing_permits", "Baugenehmigungen", "dwellings", 90000, 2022),
              ],
        trends: [],
      }
      return base as RegionProfile
    }),
  }
})

function renderCompare() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/compare"]}>
        <ComparePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Compare page", () => {
  it("shows KPI comparison, table and time series for the selected regions", () => {
    renderCompare()

    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument()
    // main KPI stats (latest values)
    expect(screen.getAllByText("62.200,4").length).toBeGreaterThan(0)
    expect(screen.getAllByText("59.334,9").length).toBeGreaterThan(0)

    // time series section
    expect(screen.getByText("Zeitreihe")).toBeInTheDocument()

    // table
    expect(screen.getByText("Letzter Stand")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Bayern" })).toHaveAttribute("href", "/region/09")
    expect(screen.getByRole("link", { name: "Baden-Württemberg" })).toHaveAttribute("href", "/region/08")
  })

  it("lists indicators only for the selected level (no kreis-only indicators)", () => {
    renderCompare()

    expect(screen.getByRole("option", { name: "BIP je Einwohner" })).toBeInTheDocument()
    // unemp_rate is kreis-only → not offered at Bundesland level
    expect(screen.queryByRole("option", { name: "Arbeitslosenquote" })).not.toBeInTheDocument()
  })

  it("computes simple differences without declaring a global winner", async () => {
    renderCompare()

    // Bundesland-level intensity difference (BW builds more per capita)
    expect(await screen.findByText(/höheres Bevölkerungswachstum:/)).toBeInTheDocument()
    expect(screen.getByText(/Baden-Württemberg: 81,8 je 10 000 Einw\./)).toBeInTheDocument()
    expect(screen.getAllByText(/kein pauschales/).length).toBeGreaterThan(0)
  })
})