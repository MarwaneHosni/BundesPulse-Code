import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExplorePage } from "@/pages/explore"
import type { Indicator, RankingsResponse, RegionGeoJson } from "@/lib/api"

vi.mock("@/lib/queries", () => ({
  useIndicators: () => ({ data: indicatorsFixture(), isError: false, isPending: false }),
  useIndicatorPeriods: () => ({
    data: { indicator: "gdp_pc", level: "bundesland", periods: [2025, 2024] },
    isPending: false,
    isError: false,
  }),
  useRankings: () => ({ data: rankingsFixture(), isPending: false, isError: false }),
  useRegionGeoJson: () => ({ data: geojsonFixture(), isPending: false, isError: false }),
}))

function indicatorsFixture(): Indicator[] {
  return [
    {
      indicator_id: 12,
      slug: "gdp_pc",
      name: "BIP je Einwohner",
      category: "Economy",
      unit: "EUR",
      description: null,
      raw_or_derived: "raw",
      levels: ["bund", "bundesland"],
      first_period: 1991,
      latest_period: 2025,
      observation_count: 520,
      regions_with_data: 16,
      source_ids: [1],
    },
    {
      indicator_id: 13,
      slug: "pop_total",
      name: "Bevölkerungsstand",
      category: "Demography",
      unit: "persons",
      description: null,
      raw_or_derived: "raw",
      levels: ["bund", "bundesland"],
      first_period: 1990,
      latest_period: 2024,
      observation_count: 520,
      regions_with_data: 16,
      source_ids: [1],
    },
    {
      indicator_id: 6,
      slug: "unemp_rate",
      name: "Arbeitslosenquote",
      category: "Employment",
      unit: "percent",
      description: null,
      raw_or_derived: "raw",
      levels: ["kreis"],
      first_period: 2025,
      latest_period: 2025,
      observation_count: 400,
      regions_with_data: 400,
      source_ids: [2001],
    },
  ]
}

function rankingsFixture(): RankingsResponse {
  return {
    indicator: "gdp_pc",
    period: 2025,
    level: "bundesland",
    count: 2,
    entries: [
      { rank: 1, region_id: "02", name: "Hamburg", type: "bundesland", value: 90208.32, percentile: 100 },
      { rank: 2, region_id: "09", name: "Bayern", type: "bundesland", value: 62200.38, percentile: 93.33 },
    ],
  }
}

function geojsonFixture(): RegionGeoJson {
  return {
    type: "FeatureCollection",
    name: "deutschland-regions",
    features: [
      {
        type: "Feature",
        properties: { region_id: "02", name: "Hamburg", type: "bundesland", parent_id: null, area_km2: 755 },
        geometry: null,
      },
      {
        type: "Feature",
        properties: { region_id: "09", name: "Bayern", type: "bundesland", parent_id: null, area_km2: 70542 },
        geometry: null,
      },
      {
        type: "Feature",
        properties: { region_id: "01001", name: "Flensburg", type: "kreis", parent_id: "01", area_km2: 56 },
        geometry: null,
      },
    ],
  }
}

function renderExplore() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/explore"]}>
        <ExplorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Explore page", () => {
  it("shows title, indicator and period controls, summary and top ranking", () => {
    renderExplore()

    expect(screen.getByRole("heading", { name: "Explore" })).toBeInTheDocument()
    expect(screen.getByText("Indikator")).toBeInTheDocument()
    expect(screen.getByText("Jahr")).toBeInTheDocument()

    // Default indicator selected; period options come from the real snapshot data.
    expect(screen.getByRole("option", { name: "BIP je Einwohner", selected: true })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "2025", selected: true })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "2024" })).toBeInTheDocument()

    // Summary KPIs.
    expect(screen.getByText("Bester Wert")).toBeInTheDocument()
    expect(screen.getByText("90.208,32")).toBeInTheDocument()
    expect(screen.getByText("Regionen ausgewertet")).toBeInTheDocument()

    // Top list with clickable regions.
    expect(screen.getByText("Rangfolge")).toBeInTheDocument()
    expect(screen.getByText("Hamburg")).toBeInTheDocument()
    expect(screen.getByText("Bayern")).toBeInTheDocument()
  })

  it("groups indicators by category and hides indicators without bundesland data", () => {
    renderExplore()

    expect(screen.getByRole("group", { name: "Economy" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Demography" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "BIP je Einwohner" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Bevölkerungsstand" })).toBeInTheDocument()
    // Kreis-only indicator must not be selectable on the Bundesländer map.
    expect(screen.queryByRole("option", { name: "Arbeitslosenquote" })).not.toBeInTheDocument()
  })

  it("does not add a level control and renders the map area", () => {
    renderExplore()

    expect(screen.queryByText("Ebene")).not.toBeInTheDocument()
    expect(screen.queryByText(/keine Daten/)).not.toBeInTheDocument()
  })
})