import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RegionPage } from "@/pages/region"
import type { Indicator, Insight } from "@/lib/api"

type InsightFixture = Omit<Insight, "indicator_id"> & { indicator_id?: number }

const BUNDESLAND = [
  "01", "02", "03", "04", "05", "06", "07", "08",
  "09", "10", "11", "12", "13", "14", "15", "16",
].map((id) => {
  const real: Record<string, string> = { "02": "Hamburg", "09": "Bayern", "16": "Thüringen" }
  return { region_id: id, name: real[id] ?? `Land${id}`, type: "bundesland", parent_id: "DE", area: 20000 }
})

const REGIONS = [
  ...BUNDESLAND,
  { region_id: "DE", name: "Deutschland", type: "bund", parent_id: null, area: 357000 },
  { region_id: "09162", name: "München, Landeshauptstadt", type: "kreis", parent_id: "09", area: 310 },
]

const SOURCES_K = [
  { source_id: 1001, provider: "Statistisches Bundesamt", dataset: "BIP in jeweiligen Preisen (VGRdL)", url: "https://example.org/vgrdl", retrieval_date: "2026-09-18" },
  { source_id: 2001, provider: "Bundesagentur für Arbeit", dataset: "Arbeitslose und Arbeitslosenquoten", url: null, retrieval_date: "2026-09-18" },
]

const INDICATORS_K: Indicator[] = [
  { indicator_id: 12, slug: "gdp_pc", name: "BIP je Einwohner", category: "Economy", unit: "EUR", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1991, latest_period: 2025, observation_count: 560, regions_with_data: 16, source_ids: [1001] },
  { indicator_id: 1, slug: "pop_total", name: "Bevölkerungsstand", category: "Demography", unit: "persons", description: null, raw_or_derived: "raw", levels: ["bund", "bundesland"], first_period: 1990, latest_period: 2024, observation_count: 67, regions_with_data: 17, source_ids: [1001] },
  { indicator_id: 6, slug: "unemp_rate", name: "Arbeitslosenquote", category: "Employment", unit: "percent", description: null, raw_or_derived: "raw", levels: ["kreis"], first_period: 2025, latest_period: 2025, observation_count: 400, regions_with_data: 400, source_ids: [2001] },
]

function insight(slug: string, over: Partial<InsightFixture>): InsightFixture {
  return {
    slug,
    name: slug,
    category: "Economy",
    unit: "EUR",
    period: 2025,
    value: null,
    previous_value: null,
    previous_period: null,
    yoy_pct: null,
    rank_desc: null,
    rank_asc: null,
    percentile: null,
    vs_de_ratio: null,
    vs_land_ratio: null,
    ...over,
  }
}

function profile09() {
  return {
    region: REGIONS.find((r) => r.region_id === "09"),
    kpis: [
      insight("gdp_pc", { name: "BIP je Einwohner", unit: "EUR", period: 2025, value: 62200.38, previous_value: 60258.36, previous_period: 2024, yoy_pct: 3.22, rank_desc: 2, rank_asc: 14, percentile: 93.33, vs_de_ratio: 1.1623 }),
      insight("pop_total", { name: "Bevölkerungsstand", unit: "persons", value: 13248928, previous_value: 13176426, previous_period: 2023, yoy_pct: 0.55, rank_desc: 2, rank_asc: 15, percentile: 93.75, vs_de_ratio: 0.1585 }),
      insight("emp_social", { name: "Beschäftigte", unit: "persons", period: 2022, value: 5865583, rank_desc: 2, rank_asc: 15, percentile: 93.75 }),
      insight("chargers_per_10k", { name: "Ladepunkte je 10 000", unit: "per 10 000", period: 2026, value: 29.78, rank_desc: 3, rank_asc: 14, percentile: 87.5, vs_de_ratio: 1.2047 }),
    ],
    trends: [
      { indicator_id: 1, slug: "pop_total", name: "Bevölkerungsstand", category: "Demography", unit: "persons", first_period: 2023, latest_period: 2024, first_value: 13176426, latest_value: 13248928, total_change_pct: 0.55, avg_annual_change_pct: 0.55, n_periods: 2 },
      { indicator_id: 12, slug: "gdp_pc", name: "BIP je Einwohner", category: "Economy", unit: "EUR", first_period: 1991, latest_period: 2025, first_value: 22920.89, latest_value: 62200.38, total_change_pct: 171.37, avg_annual_change_pct: 5.04, n_periods: 35 },
    ],
  }
}

function profileKreis() {
  return {
    region: REGIONS.find((r) => r.region_id === "09162"),
    kpis: [
      insight("unemp_rate", { name: "Arbeitslosenquote", unit: "percent", period: 2025, value: 5.3, rank_desc: 203, rank_asc: 192, percentile: 49.5 }),
      insight("unemp", { name: "Arbeitslose", unit: "persons", period: 2025, value: 49011, rank_desc: 5, rank_asc: 396, percentile: 99 }),
    ],
    trends: [],
  }
}

function series(periods: number[], values: number[]) {
  return { series: periods.map((p, i) => ({ period: p, value: values[i], absolute_change: null, percentage_change: null })) }
}

vi.mock("@/lib/queries", () => ({
  useRegionProfile: (id: unknown) => ({
    data: id === "09162" ? profileKreis() : profile09(),
    isPending: false,
    isError: false,
  }),
  useRegionNarratives: () => ({
    data: {
      region_id: "09",
      statements: [
        { id: "pop_us_de", text: "Die Bevölkerung wuchs 2024 um 0,55 % – schneller als im Bund (+0,15 %)." },
        { id: "gdp_longrun", text: "Von 1991 bis 2025 wuchs das BIP je Einwohner um +171 % (im Schnitt +5,0 % pro Jahr)." },
      ],
    },
    isPending: false,
    isError: false,
  }),
  useRegions: () => ({ data: REGIONS, isPending: false, isError: false }),
  useIndicators: () => ({ data: INDICATORS_K, isPending: false, isError: false }),
  useSources: () => ({ data: SOURCES_K, isPending: false, isError: false }),
  useRegionSeries: (id: unknown, slug: unknown) => ({
    data: {
      region: REGIONS.find((r) => r.region_id === id),
      indicator: INDICATORS_K.find((i) => i.slug === slug),
      series:
        slug === "gdp_pc"
          ? series([2024, 2025], [60258.36, 62200.38]).series
          : id === "DE"
            ? series([1991, 2025], [21000, 53516]).series
            : series([2023, 2024], [13176426, 13248928]).series,
    },
    isPending: false,
    isError: false,
  }),
  useRankings: (slug: unknown, opts: { level?: string }) => {
    const kreis = opts?.level === "kreis"
    const entries =
      slug === "unemp_rate"
        ? [{ rank: 203, region_id: "09162", name: "München, Landeshauptstadt", type: "kreis", value: 5.3, percentile: 49.5 }]
        : [
            { rank: 1, region_id: "02", name: "Hamburg", type: "bundesland", value: 90208.32, percentile: 100 },
            { rank: 2, region_id: "09", name: "Bayern", type: "bundesland", value: 62200.38, percentile: 93.33 },
          ]
    return {
      data: {
        indicator: String(slug),
        period: 2025,
        level: kreis ? "kreis" : "bundesland",
        count: kreis ? 400 : 15,
        entries,
      },
      isPending: false,
      isError: false,
    }
  },
}))

function renderRegion(regionId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/region/${regionId}`]}>
        <Routes>
          <Route path="/region/:regionId" element={<RegionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Region profile", () => {
  it("renders a complete Bundesland profile with overview, trends, comparison and sources", () => {
    renderRegion("09")

    expect(screen.getByRole("heading", { name: "Bayern" })).toBeInTheDocument()
    expect(screen.getByText(/Bundesland · AGS 09 ·/)).toBeInTheDocument()

    // Overview KPIs
    expect(screen.getAllByText("13.248.928").length).toBeGreaterThan(0)
    expect(screen.getByText("62.200")).toBeInTheDocument()
    expect(screen.getAllByText(/Rang 2 von 16/).length).toBeGreaterThan(0)

    // Trends section: selector + range label
    expect(screen.getByRole("heading", { name: "Trends" })).toBeInTheDocument()
    expect(screen.getByText("1991–2025 · 35 Jahre")).toBeInTheDocument()

    // Comparison: rank + direction
    expect(screen.getByRole("heading", { name: "Vergleich" })).toBeInTheDocument()
    expect(screen.getAllByText(/von 15/).length).toBeGreaterThan(0)
    expect(screen.getByText("Höhere Werte sind besser")).toBeInTheDocument()

    // Changes
    expect(screen.getByRole("heading", { name: "Was sich geändert hat" })).toBeInTheDocument()
    expect(screen.getAllByText(/\+3,2 %/).length).toBeGreaterThan(0)

    // Insights (rule-based section)
    expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument()
    expect(screen.getByText(/wuchs 2024 um 0,55 %/)).toBeInTheDocument()
    expect(screen.getByText(/schneller als im Bund/)).toBeInTheDocument()

    // Sources
    expect(screen.getByText("Statistisches Bundesamt")).toBeInTheDocument()
  })

  it("renders a thin Kreis profile gracefully (no trends, no changes, kreis comparison)", () => {
    renderRegion("09162")

    expect(screen.getByRole("heading", { name: "München, Landeshauptstadt" })).toBeInTheDocument()

    // No time series available
    expect(screen.getByText(/keine Zeitreihen/)).toBeInTheDocument()
    // No year-over-year comparisons
    expect(screen.getByText(/keine Vorjahresvergleiche/)).toBeInTheDocument()
    // Kreis rankings + direction hint
    expect(screen.getAllByText(/von 400/).length).toBeGreaterThan(0)
    expect(screen.getByText("Niedrigere Werte sind besser")).toBeInTheDocument()
  })
})