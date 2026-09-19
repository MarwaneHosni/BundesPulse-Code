import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react"
import { ErrorState, LoadingState } from "@/components/async-state"
import { EChart } from "@/components/echart"
import { Select } from "@/components/filters"
import { RegionNavigation } from "@/components/region-navigation"
import { useIndicators, useRegionNarratives, useRegionProfile, useRegionSeries, useRegions, useRankings, useSources } from "@/lib/queries"
import type { Insight, RankingsResponse, Region, TrendItem } from "@/lib/api"
import { cn } from "@/lib/utils"

const LEVEL_LABEL: Record<string, string> = {
  bund: "Bund",
  bundesland: "Bundesland",
  kreis: "Kreis",
}

const UNIT_LABEL: Record<string, string> = {
  persons: "Personen",
  percent: "%",
  "%": "%",
  points: "Ladepunkte",
  "per 10 000": "je 10.000",
  "Mio EUR": "Mio. €",
  EUR: "€",
  dwellings: "Wohnungen",
  accidents: "Unfälle",
  "µg/m³": "µg/m³",
}

/** higher = worse */
const NEGATIVE_DIRECTION = new Set(["unemp", "unemp_rate", "no2", "pm10", "traffic_accidents"])

/** indicators where "vs. Germany" is an intensity benchmark (per capita / rate). */
const INTENSITY_SLUGS = new Set([
  "gdp_pc",
  "chargers_per_10k",
  "unemp_rate",
  "pop_growth",
  "pop_share_65plus",
  "pop_share_under18",
])

const OVERVIEW_ORDER: Record<string, string[]> = {
  bund: ["pop_total", "gdp_pc", "chargers_per_10k", "housing_permits"],
  bundesland: ["pop_total", "gdp_pc", "emp_social", "chargers_per_10k"],
  kreis: ["unemp_rate", "unemp"],
}

const TREND_DEFAULT_ORDER = ["gdp_pc", "gdp_mio", "pop_total", "pop_growth"]
const COMPARE_DEFAULT_ORDER = ["gdp_pc", "unemp_rate", "pop_total"]

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(v)
}

function fmtCompact(v: number): string {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(v)
}

function fmtPct(v: number | null | undefined, signed = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–"
  const s = `${fmt(v, 1)} %`
  return signed && v > 0 ? `+${s}` : s
}

function valueDigits(v: number, unit?: string): number {
  if (unit === "percent" || unit === "%" || unit === "per 10 000") return 2
  return Math.abs(v) >= 1000 ? 0 : 1
}

function statValue(insight: Insight): string {
  if (insight.value == null) return "–"
  return fmt(insight.value, valueDigits(insight.value, insight.unit))
}

function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit
}

function isTrending(item: TrendItem): boolean {
  return item.n_periods >= 2 && item.first_period != null && item.latest_period != null
}

export function RegionPage() {
  const { regionId = "" } = useParams()
  const navigate = useNavigate()
  const profile = useRegionProfile(regionId)
  const narratives = useRegionNarratives(regionId)
  const regions = useRegions()
  const indicators = useIndicators()
  const sources = useSources()

  const [trendSlug, setTrendSlug] = useState<string | undefined>(undefined)
  const [compSlug, setCompSlug] = useState<string | undefined>(undefined)

  useEffect(() => {
    setTrendSlug(undefined)
    setCompSlug(undefined)
  }, [regionId])

  const region = profile.data?.region
  const kpis = useMemo(() => profile.data?.kpis ?? [], [profile.data])

  const parentName = useMemo(() => {
    if (!region?.parent_id) return undefined
    return regions.data?.find((r) => r.region_id === region.parent_id)?.name
  }, [region, regions.data])

  const typeTotal = useMemo(() => {
    if (!region) return undefined
    return regions.data?.filter((r) => r.type === region.type && r.region_id !== "DE").length
  }, [region, regions.data])

  const typeLabel = region ? (LEVEL_LABEL[region.type] ?? region.type) : ""

  // ---- overview KPIs -----------------------------------------------------
  const overviewKpis = useMemo(() => {
    const bySlug = new Map(kpis.map((k) => [k.slug, k]))
    const order = OVERVIEW_ORDER[region?.type ?? ""] ?? []
    const picked: Insight[] = []
    for (const slug of order) {
      const k = bySlug.get(slug)
      if (k) picked.push(k)
    }
    for (const k of kpis) {
      if (!picked.includes(k) && picked.length < 4) picked.push(k)
    }
    return picked.slice(0, 4)
  }, [kpis, region?.type])

  // ---- trends ------------------------------------------------------------
  const trendCandidates = useMemo(
    () => (profile.data?.trends ?? []).filter(isTrending),
    [profile.data],
  )
  const effectiveTrendSlug = useMemo(() => {
    if (trendCandidates.some((t) => t.slug === trendSlug)) return trendSlug
    for (const slug of TREND_DEFAULT_ORDER) {
      if (trendCandidates.some((t) => t.slug === slug)) return slug
    }
    return trendCandidates[0]?.slug
  }, [trendCandidates, trendSlug])
  const activeTrend = trendCandidates.find((t) => t.slug === effectiveTrendSlug)
  const hasTrends = trendCandidates.length > 0 && !!effectiveTrendSlug

  const regionSeries = useRegionSeries(regionId, effectiveTrendSlug ?? "", { enabled: hasTrends })
  const deSeries = useRegionSeries("DE", effectiveTrendSlug ?? "", {
    enabled: hasTrends && region?.type !== "bund",
  })

  // ---- comparison --------------------------------------------------------
  const compCandidates = useMemo(
    () => kpis.filter((k) => k.rank_desc != null && k.period != null),
    [kpis],
  )
  const effectiveCompSlug = useMemo(() => {
    if (compCandidates.some((k) => k.slug === compSlug)) return compSlug
    for (const slug of COMPARE_DEFAULT_ORDER) {
      if (compCandidates.some((k) => k.slug === slug)) return slug
    }
    return compCandidates[0]?.slug
  }, [compCandidates, compSlug])
  const activeComp = compCandidates.find((k) => k.slug === effectiveCompSlug)
  const compLevel = region?.type === "kreis" ? "kreis" : "bundesland"
  const ranking = useRankings(effectiveCompSlug ?? "", {
    level: compLevel,
    order: "desc",
    limit: 500,
    period: activeComp?.period ?? undefined,
    enabled: !!activeComp && !!effectiveCompSlug,
  })

  // ---- changes -----------------------------------------------------------
  const changes = useMemo(() => {
    return kpis
      .filter((k) => k.yoy_pct != null && k.previous_value != null)
      .map((k) => ({ insight: k, abs: (k.value ?? 0) - (k.previous_value ?? 0) }))
      .sort((a, b) => Math.abs(b.insight.yoy_pct ?? 0) - Math.abs(a.insight.yoy_pct ?? 0))
      .slice(0, 6)
  }, [kpis])

  // ---- sources -----------------------------------------------------------
  const relevantSources = useMemo(() => {
    const indBySlug = new Map((indicators.data ?? []).map((i) => [i.slug, i]))
    const ids = new Set<number>()
    for (const k of kpis) {
      for (const sid of indBySlug.get(k.slug)?.source_ids ?? []) ids.add(sid)
    }
    return (sources.data ?? []).filter((s) => ids.has(s.source_id))
  }, [kpis, indicators.data, sources.data])

  if (profile.isPending || regions.isPending) {
    return (
      <div className="container py-8">
        <LoadingState label="Profil wird geladen …" />
      </div>
    )
  }

  if (profile.isError || !region) {
    return (
      <div className="container py-8">
        <ErrorState message={String(profile.error?.message ?? "Region nicht gefunden")} />
      </div>
    )
  }

  const hierarchy = region.type === "bund"
    ? "Bundesrepublik Deutschland"
    : `${typeLabel}${parentName && region.type === "kreis" ? ` im ${parentName}` : ""} · AGS ${region.region_id} · ${fmt(region.area, 1)} km²`

  return (
    <div className="container py-8">
      {/* header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Link to="/explore" className="text-sm text-muted-foreground hover:underline">
          ‹ Deutschlandkarte
        </Link>
        <RegionNavigation regionId={regionId} onChange={(id) => navigate(`/region/${id}`)} />
      </div>

      <div className="border-b pb-6">
        <h1 className="text-[34px] font-semibold leading-[40px] tracking-tight">{region.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{hierarchy}</p>
      </div>

      {/* section nav */}
      <nav className="mb-8 mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground" aria-label="Seitenbereiche">
        {[
          ["uebersicht", "Überblick"],
          ["insights", "Insights"],
          ["trends", "Trends"],
          ["vergleich", "Vergleich"],
          ["aenderungen", "Was sich geändert hat"],
          ["quellen", "Quellen"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="hover:text-foreground hover:underline">
            {label}
          </a>
        ))}
      </nav>

      {/* overview */}
      <section id="uebersicht" className="scroll-mt-20">
        <h2 className="mb-5 text-sm font-medium text-muted-foreground">Überblick</h2>
        <div className={`grid gap-x-10 gap-y-6 sm:grid-cols-2 ${overviewKpis.length <= 2 ? "lg:grid-cols-2" : "lg:grid-cols-4"}`}>
          {overviewKpis.map((k) => (
            <ProfileStat key={k.slug} insight={k} typeTotal={typeTotal} />
          ))}
        </div>
      </section>

      {/* insights (rule-based, prominent) */}
      {!narratives.isError && (
        <section id="insights" className="mt-12 scroll-mt-20 border-t pt-8">
          <SectionHeading
            title="Insights"
            subtitle="Regelbasierte Einordnung – jede Aussage ist direkt aus den Snapshot-Werten abgeleitet."
          />
          {narratives.isPending ? (
            <LoadingState label="Insights werden berechnet …" />
          ) : narratives.data && narratives.data.statements.length > 0 ? (
            <ul className="max-w-2xl space-y-3 text-sm">
              {narratives.data.statements.map((s, i) => (
                <li key={s.id} className="flex gap-2.5">
                  <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Keine regelbasierten Aussagen für {region.name} verfügbar.</p>
          )}
        </section>
      )}

      {/* trends */}
      <section id="trends" className="mt-12 scroll-mt-20 border-t pt-8">
        <SectionHeading
          title="Trends"
          subtitle="Zeitreihe der Region im Vergleich zu Deutschland – aus dem Snapshot."
        />
        {!hasTrends ? (
          <p className="text-sm text-muted-foreground">
            Für {region.name} liegen im Snapshot keine Zeitreihen mit mehr als einem Jahreswert vor.
          </p>
        ) : (
          <div className="lg:max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Select value={effectiveTrendSlug ?? ""} onChange={(e) => setTrendSlug(e.target.value)} className="max-w-full">
                {trendCandidates.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {activeTrend?.n_periods != null && (
                <span className="text-xs text-muted-foreground">
                  {activeTrend.first_period}–{activeTrend.latest_period} · {activeTrend.n_periods} Jahre
                </span>
              )}
            </div>
            <EChart option={trendOption(regionSeries, deSeries, region, activeTrend?.unit ?? "")} height={340} />
          </div>
        )}
      </section>

      {/* comparison */}
      <section id="vergleich" className="mt-12 scroll-mt-20 border-t pt-8">
        <SectionHeading
          title="Vergleich"
          subtitle={
            region.type === "kreis"
              ? "Wo steht die Region im Vergleich aller Kreise?"
              : "Wo steht die Region im Vergleich der Bundesländer?"
          }
        />
        {!activeComp ? (
          <p className="text-sm text-muted-foreground">Für {region.name} liegen hier keine Ränge vor.</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Select value={effectiveCompSlug ?? ""} onChange={(e) => setCompSlug(e.target.value)} className="max-w-full">
                  {compCandidates.map((k) => (
                    <option key={k.slug} value={k.slug}>
                      {k.name}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-muted-foreground">Stand {activeComp.period}</span>
              </div>
              <EChart option={comparisonOption(ranking.data?.entries ?? [], regionId, activeComp)} height={Math.max(260, Math.min(560, entriesLength(ranking.data?.entries ?? [], regionId) * 22 + 60))} />
            </div>
            <ComparisonPanel activeComp={activeComp} regionId={regionId} ranking={ranking.data} />
          </div>
        )}
      </section>

      {/* what changed */}
      <section id="aenderungen" className="mt-12 scroll-mt-20 border-t pt-8">
        <SectionHeading
          title="Was sich geändert hat"
          subtitle="Jüngste Veränderung gegenüber der Vorperiode – die stärksten zuerst."
        />
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Für {region.name} liegen keine Vorjahresvergleiche im Snapshot vor.
          </p>
        ) : (
          <ul className="max-w-2xl">
            {changes.map(({ insight, abs }) => (
              <ChangeRow key={insight.slug} insight={insight} abs={abs} />
            ))}
          </ul>
        )}
      </section>

      {/* sources */}
      <section id="quellen" className="mt-12 scroll-mt-20 border-t pt-8">
        <SectionHeading
          title="Quellen"
          subtitle="Offizielle Datenquellen für die im Profil gezeigten Indikatoren."
        />
        {relevantSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Quellen zugeordnet.</p>
        ) : (
          <ul className="max-w-2xl space-y-2 text-sm">
            {relevantSources.map((s) => (
              <li key={s.source_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium">{s.provider}</span>
                <span className="text-muted-foreground">– {s.dataset}</span>
                {s.url ? (
                  <a className="inline-flex items-center gap-0.5 text-primary hover:underline" href={s.url} target="_blank" rel="noreferrer">
                    Quelle <ExternalLink className="size-3" />
                  </a>
                ) : null}
                <span className="w-full text-xs text-muted-foreground">
                  abgerufen am {s.retrieval_date ? fmtDate(s.retrieval_date) : "–"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- section helpers

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function ProfileStat({ insight, typeTotal }: { insight: Insight; typeTotal?: number }) {
  const rank = insight.rank_desc ?? null
  const vsDe = insight.vs_de_ratio
  const footer = [
    `Stand ${insight.period ?? "–"}`,
    rank != null ? `Rang ${rank}${typeTotal ? ` von ${typeTotal}` : ""}` : null,
  ]
    .filter((x): x is string => !!x)
    .join(" · ")

  return (
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">{insight.name}</p>
      <p className="mt-1.5 text-[30px] font-semibold leading-[34px] tabular-nums tracking-tight">
        {statValue(insight)}
        <span className="ml-1 text-base font-normal text-muted-foreground">{unitLabel(insight.unit)}</span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{footer}</p>
      {vsDe != null && vsDe !== 1 && (
        <p className="mt-0.5 text-xs text-foreground/80">
          {INTENSITY_SLUGS.has(insight.slug)
            ? `${fmt(Math.abs((vsDe - 1) * 100), 0)} % ${vsDe >= 1 ? "über" : "unter"} dem Bundeswert`
            : `${fmt(vsDe * 100, 1)} % der deutschen Gesamtsumme`}
        </p>
      )}
    </div>
  )
}

function ChangeRow({ insight, abs }: { insight: Insight; abs: number }) {
  const yoy = insight.yoy_pct ?? 0
  const up = yoy >= 0
  const negative = NEGATIVE_DIRECTION.has(insight.slug)
  const good = negative ? !up : up
  const isRate = insight.unit === "percent" || insight.unit === "%"
  const changeText = isRate
    ? (up ? "+" : "") + fmt(abs, 2) + " Pkt."
    : fmt(abs, 0)

  return (
    <li className="flex items-baseline justify-between gap-4 border-t py-3 text-sm">
      <div>
        <span className="font-medium">{insight.name}</span>{" "}
        <span className="text-muted-foreground">{unitLabel(insight.unit)}</span>
      </div>
      <div className="flex items-baseline gap-2 whitespace-nowrap text-right">
        <span className="text-xs text-muted-foreground">
          {insight.previous_period ?? "Vorperiode"} → {insight.period}
        </span>
        <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-emerald-600" : "text-destructive")}>
          {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {isRate ? changeText : `${fmtPct(yoy)} (${changeText})`}
        </span>
      </div>
    </li>
  )
}

function ComparisonPanel({
  activeComp,
  regionId,
  ranking,
}: {
  activeComp: Insight
  regionId: string
  ranking: RankingsResponse | undefined
}) {
  const rankRow = ranking?.entries.find((e) => e.region_id === regionId)
  const count = ranking?.count
  const lowerIsBetter = NEGATIVE_DIRECTION.has(activeComp.slug)

  return (
    <div className="space-y-5">
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Rang</p>
        <p className="mt-1 text-[30px] font-semibold leading-[34px] tabular-nums">
          #{rankRow?.rank ?? "–"}
          {count != null && <span className="ml-1 text-base font-normal text-muted-foreground">von {count}</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeComp.percentile != null ? `Perzentil ${fmt(activeComp.percentile, 0)}` : "Stand " + (activeComp.period ?? "–")}
        </p>
      </div>
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Richtung</p>
        <p className="mt-1 text-sm">{lowerIsBetter ? "Niedrigere Werte sind besser" : "Höhere Werte sind besser"}</p>
      </div>
      {activeComp.yoy_pct != null && activeComp.previous_value != null && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Gegenüber {activeComp.previous_period}: {fmtPct(activeComp.yoy_pct)} (aktueller Stand {activeComp.period}).
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- charts

function trendOption(
  regionSeries: { data?: { series: Array<{ period: number; value: number }> } },
  deSeries: { data?: { series: Array<{ period: number; value: number }> } },
  region: Region,
  unit: string,
): Record<string, unknown> {
  const de = deSeries?.data?.series ?? []
  const reg = regionSeries?.data?.series ?? []
  const periods = Array.from(new Set([...reg.map((p) => p.period), ...de.map((p) => p.period)])).sort((a, b) => a - b)
  const deMap = new Map(de.map((p) => [p.period, p.value]))
  const regMap = new Map(reg.map((p) => [p.period, p.value]))

  const showPoints = periods.length <= 12
  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number | null) => (v == null ? "–" : fmt(v) + (unit ? ` ${unit}` : "")),
    },
    legend: de.length ? { top: 0, right: 0, itemWidth: 14 } : undefined,
    grid: { left: 8, right: 16, top: de.length ? 8 : 8, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: periods.map((p) => String(p)), boundaryGap: false },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { formatter: (v: number) => fmtCompact(v) },
    },
    series: [
      {
        name: region.name,
        type: "line",
        smooth: true,
        symbol: "circle",
        showSymbol: showPoints,
        connectNulls: false,
        lineStyle: { color: "#1c6db0", width: 2.5 },
        itemStyle: { color: "#1c6db0" },
        emphasis: { focus: "series" },
        data: periods.map((p) => (regMap.has(p) ? regMap.get(p)! : null)),
      },
      ...(de.length
        ? [
            {
              name: "Deutschland",
              type: "line",
              smooth: true,
              symbol: "circle",
              showSymbol: false,
              connectNulls: false,
              lineStyle: { color: "#94a3b8", width: 1.5, type: "dashed" as const },
              itemStyle: { color: "#94a3b8" },
              emphasis: { focus: "series" },
              data: periods.map((p) => (deMap.has(p) ? deMap.get(p)! : null)),
            },
          ]
        : []),
    ],
  }
}

function entriesLength(entries: Array<{ region_id: string }>, regionId: string): number {
  if (entries.length > 20) {
    const idx = entries.findIndex((e) => e.region_id === regionId)
    return idx >= 0 ? Math.min(13, entries.length) : 13
  }
  return entries.length
}

function comparisonOption(
  entries: Array<{ region_id: string; name: string; value: number }>,
  regionId: string,
  comp: Insight,
): Record<string, unknown> {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  let shown = sorted
  if (sorted.length > 20) {
    const idx = sorted.findIndex((e) => e.region_id === regionId)
    if (idx >= 0) shown = sorted.slice(Math.max(0, idx - 6), idx + 7)
  }
  const deValue = comp.vs_de_ratio ? comp.value! / comp.vs_de_ratio : null
  const bars = shown
    .map((e) => ({
      value: e.value,
      itemStyle: { color: e.region_id === regionId ? "#1c6db0" : "#b3d2ef" },
    }))
    .reverse()

  return {
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
      valueFormatter: (v: number | null) => (v == null ? "–" : fmt(v) + (comp.unit ? ` ${unitLabel(comp.unit)}` : "")),
    },
    grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => fmtCompact(v) },
    },
    yAxis: {
      type: "category",
      data: shown.map((e) => e.name).reverse(),
      axisLabel: { fontSize: 12 },
    },
    series: [
      {
        type: "bar",
        data: bars,
        barMaxWidth: 20,
        label: {
          show: true,
          position: "right",
          color: "#64748b",
          fontSize: 11,
          formatter: (p: { value: number }) => fmt(p.value, 0),
        },
        markLine:
          deValue && deValue > 0
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: "#94a3b8", type: "dashed" as const, width: 1 },
                label: { formatter: "Bund", position: "insideEndTop", color: "#94a3b8", fontSize: 11 },
                data: [{ xAxis: deValue }],
              }
            : undefined,
      },
    ],
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE")
}