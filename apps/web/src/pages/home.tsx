import { Link, useNavigate } from "react-router-dom"
import {
  Activity,
  ArrowUpRight,
  Award,
  Briefcase,
  CalendarDays,
  Car,
  Circle,
  Database,
  Factory,
  GraduationCap,
  Home as HomeIcon,
  Landmark,
  Leaf,
  LineChart,
  Map as MapIcon,
  Plane,
  Sprout,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/async-state"
import { MapLegend, RegionsMap, type RegionDatum } from "@/components/regions-map"
import {
  useIndicators,
  useMetadata,
  useRankings,
  useRegionGeoJson,
  useRegions,
} from "@/lib/queries"
import type { Indicator } from "@/lib/api"
import { categoryColor, categoryTint } from "@/lib/category-colors"
import { cn } from "@/lib/utils"

const CATEGORY_ICON: Record<string, typeof LineChart> = {
  Demography: Users,
  Labour: Briefcase,
  Employment: Briefcase,
  Economy: TrendingUp,
  Income: Wallet,
  Housing: HomeIcon,
  Education: GraduationCap,
  Environment: Leaf,
  Agriculture: Sprout,
  Industry: Factory,
  Mobility: Car,
  Infrastructure: Zap,
  Tourism: Plane,
  Health: Activity,
  "Public finance": Landmark,
}

function categoryIcon(category: string) {
  return CATEGORY_ICON[category] ?? Circle
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–"
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n)
}

const fmtInt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 })

function groupByCategory(indicators: Indicator[]): Array<[string, Indicator[]]> {
  const m = new Map<string, Indicator[]>()
  for (const ind of indicators) {
    const list = m.get(ind.category) ?? []
    list.push(ind)
    m.set(ind.category, list)
  }
  return [...m.entries()]
}

export function HomePage() {
  const navigate = useNavigate()
  const regions = useRegions()
  const indicators = useIndicators()
  const meta = useMetadata()
  const ranking = useRankings("unemp_rate", { level: "kreis", order: "asc", limit: 5 })

  // map (Bundesländer, BIP je Einwohner)
  const mapRanking = useRankings("gdp_pc", { level: "bundesland", order: "desc", limit: 500 })
  const geojson = useRegionGeoJson()
  const mapIndicator = indicators.data?.find((i) => i.slug === "gdp_pc")
  const mapEntries = mapRanking.data?.entries ?? []
  const mapData: Record<string, RegionDatum> = {}
  for (const e of mapEntries) mapData[e.region_id] = { value: e.value, rank: e.rank }
  const mapGeo = geojson.data
    ? {
        ...geojson.data,
        features: geojson.data.features.filter((f) => f.properties.type === "bundesland"),
      }
    : undefined
  const mapMin = mapEntries.length ? Math.min(...mapEntries.map((e) => e.value)) : 0
  const mapMax = mapEntries.length ? Math.max(...mapEntries.map((e) => e.value)) : 1

  const all = regions.data ?? []
  const laender = all.filter((r) => r.type === "bundesland").length
  const kreise = all.filter((r) => r.type === "kreis").length

  const inds = indicators.data ?? []
  const byCategory = groupByCategory(inds)
  const byCount = [...byCategory].sort((a, b) => b[1].length - a[1].length)
  const byAlpha = [...byCategory].sort((a, b) => a[0].localeCompare(b[0], "de"))

  const firstPeriods = inds.map((i) => i.first_period).filter((v): v is number => v != null)
  const latestPeriods = inds.map((i) => i.latest_period).filter((v): v is number => v != null)
  const fromYear = firstPeriods.length ? Math.min(...firstPeriods) : null
  const toYear = latestPeriods.length ? Math.max(...latestPeriods) : null

  const providers = [...new Set((meta.data?.sources ?? []).map((s) => s.provider))]

  const entries = ranking.data?.entries ?? []
  const maxV = entries.length ? Math.max(...entries.map((e) => e.value)) : 0
  const minV = entries.length ? Math.min(...entries.map((e) => e.value)) : 0
  const barPct = (v: number) => (maxV === minV ? 100 : 8 + ((maxV - v) / (maxV - minV)) * 92)

  return (
    <div className="w-full">
      {/* masthead + interactive map — one full-bleed card, no margins */}
      <section className="relative overflow-hidden border-b bg-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-28 size-72 rounded-full bg-primary/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/4 -bottom-32 size-80 rounded-full bg-muted"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-10 size-40 rounded-full border border-primary/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-12 left-1/2 size-6 rounded-full bg-primary/10"
        />

        <div className="grid lg:grid-cols-2">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Offene Regionaldaten
              </span>
              <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.75rem]">
                Deutschland Digital Monitor
              </h1>
              <p className="mt-4 max-w-[62ch] text-base leading-7 text-muted-foreground">
                Offene Regionaldaten für Deutschland: Bund, Bundesländer und Landkreise / kreisfreie
                Städte — erkunden, vergleichen, einordnen.
              </p>
              <div className="mt-7">
                <Button asChild size="lg" className="rounded-full px-6">
                  <Link to="/explore">Deutschlandkarte öffnen</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="relative px-4 pb-6 sm:px-6 lg:border-l lg:py-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {mapIndicator ? `${mapIndicator.name} · ${mapIndicator.unit}` : "Bundesländer"}
              </p>
              <Link
                to="/explore"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                In Explore öffnen
              </Link>
            </div>
            {mapRanking.isPending || geojson.isPending || !mapGeo ? (
              <LoadingState label="Karte wird geladen …" />
            ) : (
              <>
                <RegionsMap
                  geojson={mapGeo}
                  data={mapData}
                  unit={mapIndicator?.unit}
                  rankTotal={mapRanking.data?.count}
                  onSelect={(id) => navigate(`/region/${id}`)}
                />
                <MapLegend
                  unit={mapIndicator?.unit ?? undefined}
                  min={mapMin}
                  max={mapMax}
                  hasMissing={
                    mapRanking.data?.count != null &&
                    mapGeo.features.length > mapRanking.data.count
                  }
                  missingCount={
                    mapRanking.data?.count != null
                      ? Math.max(0, mapGeo.features.length - mapRanking.data.count)
                      : undefined
                  }
                />
              </>
            )}
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* stat ribbon */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-4">
          <div className="group relative flex flex-col bg-card p-5 transition-colors hover:bg-muted/30">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 font-display text-3xl font-semibold tabular-nums leading-none text-foreground/[0.07]"
            >
              01
            </span>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: "#12457E1f", color: "#12457E" }}
              >
                <MapIcon className="size-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Regionen</span>
            </div>
            <p className="mt-4 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
              {regions.data?.length ?? "–"}
            </p>
            <div className="mt-auto pt-5">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="h-full"
                  style={{
                    width: `${(laender / Math.max(1, all.length)) * 100}%`,
                    backgroundColor: "#12457E",
                  }}
                />
                <span
                  className="h-full"
                  style={{
                    width: `${(kreise / Math.max(1, all.length)) * 100}%`,
                    backgroundColor: "#12457E66",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {laender} Länder · {kreise} Kreise
              </p>
            </div>
          </div>

          <div className="group relative flex flex-col bg-card p-5 transition-colors hover:bg-muted/30">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 font-display text-3xl font-semibold tabular-nums leading-none text-foreground/[0.07]"
            >
              02
            </span>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: "#2E8B8B1f", color: "#2E8B8B" }}
              >
                <LineChart className="size-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Indikatoren</span>
            </div>
            <p className="mt-4 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
              {indicators.data?.length ?? "–"}
            </p>
            <div className="mt-auto pt-5">
              <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                {byCategory.map(([category]) => (
                  <span
                    key={category}
                    className="h-full flex-1"
                    style={{ backgroundColor: categoryColor(category) }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">in {byCategory.length} Kategorien</p>
            </div>
          </div>

          <div className="group relative flex flex-col bg-card p-5 transition-colors hover:bg-muted/30">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 font-display text-3xl font-semibold tabular-nums leading-none text-foreground/[0.07]"
            >
              03
            </span>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: "#B8822E1f", color: "#B8822E" }}
              >
                <Database className="size-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Quellen</span>
            </div>
            <p className="mt-4 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
              {meta.data?.sources.length ?? "–"}
            </p>
            <div className="mt-auto pt-5">
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: meta.data?.sources.length ?? 0 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="size-2.5 rounded-[3px]"
                    style={{ backgroundColor: "#B8822E" }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">amtliche Anbieter</p>
            </div>
          </div>

          <div className="group relative flex flex-col bg-card p-5 transition-colors hover:bg-muted/30">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 font-display text-3xl font-semibold tabular-nums leading-none text-foreground/[0.07]"
            >
              04
            </span>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: "#5A6A8A1f", color: "#5A6A8A" }}
              >
                <CalendarDays className="size-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Snapshot</span>
            </div>
            <p className="mt-4 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
              {meta.data?.snapshot.built_at_utc
                ? new Date(meta.data.snapshot.built_at_utc).toLocaleDateString("de-DE")
                : "–"}
            </p>
            <div className="mt-auto pt-5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {fromYear ?? "–"}
                </span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="absolute inset-0 h-full"
                    style={{ backgroundColor: "#5A6A8A" }}
                  />
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {toYear ?? "–"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">unveränderlich</p>
            </div>
          </div>
        </section>

        {/* feature columns */}
        <section className="relative mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-[1.15fr_1fr]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-40 rounded-full border border-primary/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-24 top-16 size-10 rounded-full bg-primary/[0.05]"
          />

          {/* labour-market leaderboard */}
          <div className="relative">
            <div className="flex items-center gap-3 border-b pb-3">
              <Award className="size-4 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Beste Arbeitsmärkte
                </h2>
                <p className="text-xs text-muted-foreground">niedrigste Arbeitslosenquote (Kreise)</p>
              </div>
            </div>
            {ranking.isError && (
              <p className="pt-4 text-sm text-destructive">
                Rankings nicht verfügbar: {String(ranking.error).slice(0, 80)}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>niedriger ist besser</span>
              <span>Quote in %</span>
            </div>
            <ol className="mt-2 space-y-1">
              {entries.map((e, i) => {
                const top = i === 0
                return (
                  <li key={e.region_id}>
                    <Link
                      to={`/region/${e.region_id}`}
                      className={cn(
                        "group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 rounded-xl px-2 py-2.5 transition-colors",
                        top ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-10 place-items-center rounded-xl border font-display text-sm font-semibold tabular-nums",
                          i === 0
                            ? "border-transparent bg-primary text-primary-foreground"
                            : i < 3
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-border bg-muted/50 text-muted-foreground",
                        )}
                      >
                        {e.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium group-hover:underline">
                            {e.name}
                          </span>
                          <ArrowUpRight
                            className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </div>
                        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              top ? "bg-primary" : "bg-primary/55",
                            )}
                            style={{ width: `${barPct(e.value)}%` }}
                          />
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-semibold leading-none tabular-nums">
                          {fmt(e.value)}
                          <span className="ml-0.5 text-xs font-normal text-muted-foreground">%</span>
                        </div>
                        {e.percentile != null && (
                          <div className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                            besser als {fmtInt.format(Math.max(0, 100 - e.percentile))} %
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
            {entries.length > 0 && (
              <div className="mt-4">
                <Link
                  to="/rankings"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Alle Ranglisten
                </Link>
              </div>
            )}
          </div>

          {/* category composition */}
          <div className="relative">
            <div className="flex items-center gap-3 border-b pb-3">
              <LineChart className="size-4 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Indikatoren (real)
                </h2>
                <p className="text-xs text-muted-foreground">
                  alle Indikatoren im vorbereiteten Snapshot
                </p>
              </div>
            </div>
            <div className="mt-5">
              <div
                className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Verteilung der Indikatoren nach Kategorie"
              >
                {byCount.map(([category, list]) => (
                  <span
                    key={category}
                    title={`${category}: ${list.length}`}
                    className="h-full transition-opacity hover:opacity-80"
                    style={{
                      width: `${(list.length / Math.max(1, inds.length)) * 100}%`,
                      backgroundColor: categoryColor(category),
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                <span>{byCategory.length} Kategorien</span>
                <span>{inds.length} Indikatoren</span>
              </div>
            </div>
            <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {byCount.map(([category, list]) => (
                <li key={category} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: categoryColor(category) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{category}</span>
                  <span className="shrink-0 font-medium tabular-nums">{list.length}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* indicator catalogue — grouped register */}
        <section className="mt-12 border-t pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Indikatorenkatalog
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {inds.length} Indikatoren in {byCategory.length} Kategorien, {fromYear ?? "–"}–
                {toYear ?? "–"}
              </p>
            </div>
            <Link
              to="/explorer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Im Datenexplorer öffnen
            </Link>
          </div>

          <div className="mt-6 divide-y divide-border border-t">
            {byAlpha.map(([category, list]) => {
              const Icon = categoryIcon(category)
              const color = categoryColor(category)
              return (
                <div key={category} className="grid gap-x-10 gap-y-3 py-5 sm:grid-cols-[12rem_1fr]">
                  <div className="flex items-center gap-2 sm:pt-0.5">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: categoryTint(category, 0.12), color }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate font-display text-sm font-semibold">{category}</span>
                    <span className="text-xs font-normal tabular-nums text-muted-foreground">
                      {list.length}
                    </span>
                  </div>
                  <ul className="grid gap-x-10 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((ind) => (
                      <li
                        key={ind.slug}
                        className="flex items-baseline gap-2 py-0.5 text-sm"
                      >
                        <span className="min-w-0 truncate">{ind.name}</span>
                        <span
                          aria-hidden="true"
                          className="h-px min-w-4 flex-1 self-center border-b border-dotted"
                          style={{ borderColor: categoryTint(category, 0.4) }}
                        />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {ind.latest_period ?? "–"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* colophon */}
        <section className="mt-12 border-t pt-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{providers.length} Anbieter</span>
            <div className="flex flex-wrap gap-1.5">
              {providers.map((p) => (
                <span
                  key={p}
                  className="max-w-full truncate rounded-full border bg-muted/50 px-2 py-0.5 text-[11px]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-4 max-w-[70ch] text-sm text-muted-foreground">
            Alle Darstellungen lesen ausschließlich den vorbereiteten DuckDB-Snapshot — gemessen in
            wenigen Millisekunden, ohne externe Abfragen zur Laufzeit.
          </p>
        </section>
      </div>
    </div>
  )
}
