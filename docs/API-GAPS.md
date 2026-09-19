# API gaps — BundesPulse frontend remodel

Everything the remodeled UI needs that the current read‑only API does **not**
yet expose. For each: the view, the data needed, the smallest server‑side
addition, and the fallback the frontend will ship until that exists. No runtime
computation is added to the backend to paper over a gap.

Existing endpoints (verified against `backend/api/*`):

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/health` | – | snapshot status |
| `GET /api/regions` | `level?` | `Region[]` (id, name, type, parent_id, area) |
| `GET /api/regions/{id}` | – | `Region` |
| `GET /api/indicators` | – | `Indicator[]` (slug, name, category, unit, levels, periods, counts, source_ids) |
| `GET /api/regions/{id}/profile` | – | region + `Insight[]` (value, yoy, rank_desc/asc, percentile, vs_de/land) + `TrendItem[]` |
| `GET /api/regions/{id}/insights` | – | `Insight[]` |
| `GET /api/regions/{id}/narratives` | – | rule‑based statements |
| `GET /api/regions/{id}/indicators/{slug}` | – | `{region, indicator, series[]}` |
| `GET /api/compare` | `regions` (1–4), `indicator` | per‑region `series[]` |
| `GET /api/rankings` | `indicator`, `period?`, `level`, `order`, `limit(≤500)` | rank rows (region_id, name, type, value, percentile, rank) |
| `GET /api/correlation` | `x`, `y`, `level?`, `period?` | pearson, spearman, `points[]` |
| `GET /api/indicators/{slug}/periods` | `level` | `periods[]` |
| `GET /api/regions.geojson` | – | 416 features (16 Bundesland + 400 Kreis), EPSG:4326, 10.5 MB |
| `GET /api/sources` · `GET /api/metadata` | – | sources / snapshot + catalogue |

---

## G1 — Indicator direction (higher‑is‑better vs lower‑is‑better) — **blocking**

- **Views:** Rankings (default sort), Explore/Atlas ("best" end of the ramp),
  Fingerprint orientation, Compare "better/worse", any good/bad colouring.
- **Needed:** a per‑indicator field telling whether a high value is "good"
  (e.g. GDP) or low is "good" (e.g. unemployment rate, NO₂, road fatalities).
  Today `Indicator` has no such field; `order=asc|desc` is chosen by the client
  per request, which risks inverted rankings.
- **Smallest addition:** add `higher_is_better: bool` to the `indicators` table
  and to `Indicator` (`backend/api/schemas.py`) — set in `pipeline/build_data.py`
  from a small curated slug list. No new endpoint.
- **Fallback meanwhile:** a curated constant in the frontend
  (`lib/indicator-direction.ts`) listing the "lower‑is‑better" slugs, used only
  to choose `order` and colour ends; documented as provisional and derived from
  the indicator's name/unit. Never used to compute values.

## G2 — Two‑scale positioning: rank **within the Bundesland**

- **View:** Region profile KPI "positioning bar" (Kreis rank among the Kreise of
  its Land **and** among all Kreise nationally).
- **Needed:** a rank/percentile computed over the subset of Kreise sharing a
  parent Bundesland. `Insight` gives national `rank_desc/asc` + `percentile` +
  `vs_land_ratio` (magnitude), but not the in‑state *rank*.
- **Smallest addition:** optional `parent` query param on `/rankings`
  (e.g. `?level=kreis&parent=09`) restricting and re‑ranking the pool; or two
  extra precomputed columns (`land_rank_desc`, `land_percentile`) in `insights`.
- **Fallback meanwhile:** show the national rank/percentile **and**
  `vs_land_ratio` as a labelled comparison ("108 % des Landeswerts"); the
  in‑state rank position is deferred until G2 lands.

## G3 — "Ähnliche Regionen" (similar regions)

- **View:** Region profile peer module; Compare suggestion.
- **Needed:** for a level, the per‑region vector of category scores (one
  representative indicator per category → its percentile), so peers can be
  found by a simple distance.
- **Smallest addition:** `GET /api/fingerprints?level=kreis` returning
  `{region_id, scores: {category: percentile}}[]` (or `/regions/{id}/similar`).
  Precompute in `build_data` from existing `insights`.
- **Fallback meanwhile:** the profile already returns `percentile` for **every**
  KPI (verified: 87 for München, 102 for Bayern), so a **labelled, in‑browser**
  similarity over the region's own category percentiles is possible. This is the
  one deliberate exception to "no client‑side statistics": it is explicitly
  requested in the brief (§3.1), is descriptive only, and is labelled
  "Ähnlichkeit veröffentlichter Kennzahlen – im Browser berechnet".

## G4 — Streuung / disparity read

- **Views:** Region profile ("so weit streut das Land"), Explore side panel.
- **Needed:** top‑20 % vs bottom‑20 % gap for an indicator, within a Bundesland
  and nationally.
- **Smallest addition:** `GET /api/disparity?indicator=&level=&parent?` **or**
  precomputed `spread` columns. Pure aggregation over `values` already in the
  snapshot.
- **Fallback meanwhile:** derive the spread from a `/rankings` response
  (`order=desc`, limit ≤ 500) in the browser. Because this *is* a statistic, the
  fallback is either omitted or shown with an explicit "im Browser berechnet"
  note. Preferred path is the server endpoint.

## G5 — Context series in one call (region + parent + Deutschland)

- **View:** every Region profile chart (comparison line baked in).
- **Needed:** series for the region, its parent Bundesland, and `DE` for one
  slug, in a single response, to build 3‑line charts without 3 requests.
- **Smallest addition:** `GET /api/regions/{id}/series/{slug}/context`
  (or `include=parent,de` on the existing series endpoint).
- **Fallback meanwhile:** three existing series calls
  (`/regions/{id}/indicators/{slug}`, `/regions/{parent}/indicators/{slug}`,
  `/regions/DE/indicators/{slug}`). Works today; just chattier. TanStack Query
  caches them, and `DE` series are shared across regions.

## G6 — Batch profile / fingerprint for Compare & Similar

- **Views:** Compare (2–4 regions), Similar regions list, Home cards.
- **Needed:** profile/KPI data for N regions without N round‑trips.
- **Smallest addition:** `GET /api/regions/profiles?ids=a,b,c` (or a batch
  fingerprint endpoint). Optional — profiles are ~6–10 KB each.
- **Fallback meanwhile:** parallel `useQueries` per region id (already fine for
  ≤ 8 regions).

## G7 — Per‑capita toggle for arbitrary indicators

- **View:** Region profile / Compare "je Einwohner" toggle.
- **Needed:** server‑normalised value = value / population, for a chosen slug.
- **Smallest addition:** `normalize=per_capita` on series/rankings, or ship more
  derived per‑capita indicators in the pipeline.
- **Fallback meanwhile:** expose the toggle only for indicators that already
  exist in per‑capita form (`gdp_pc`, `chargers_per_10k`, …) and for counts where
  a published per‑capita sibling exists. No client‑side division of arbitrary
  indicators.

## G8 — `parent_id` / `parent_name` on ranking rows (convenience)

- **Views:** Rankings table (group/label by Land), Map tooltip.
- **Needed:** the parent Bundesland for each Kreis row without string surgery.
- **Smallest addition:** add `parent_id` (and `parent_name`) to `RankingRow`.
- **Fallback meanwhile:** derive from `region_id.slice(0,2)` and resolve the name
  from the cached `/regions` list.

## G9 — Simplified geometry variant (performance)

- **Views:** Explore/Atlas at low zoom, small multiples.
- **Needed:** a lighter `regions.geojson` for fast first paint; the current file
  is 10.5 MB (416 features of real VG250).
- **Smallest addition:** a `simplified` build output (e.g.
  `regions.simplified.geojson`) or `?simplify=1` on `/api/regions.geojson`.
- **Fallback meanwhile:** load the full file once (TanStack Query
  `staleTime: Infinity`, already configured), render both levels from it, and
  rely on MapLibre's own simplification. Acceptable on desktop; noted as a
  follow‑up for slow connections.

---

## Not gaps (verified available)

- Full 111‑indicator catalogue with `levels`, periods, units, `source_ids`.
- Per‑region KPIs with `percentile`, `rank_desc/asc`, `yoy_pct`,
  `vs_de_ratio`, `vs_land_ratio` — every KPI carries a percentile (checked).
- Multi‑year series for 95/111 indicators (1990–2026 overall).
- Rankings for 90 Kreis‑level and 102 Bundesland‑level indicators.
- Correlation (Pearson + Spearman) and point cloud.
- Both geography levels in one GeoJSON with `region_id/name/type/parent_id/area_km2`.
- Sources with provider/dataset/URL/retrieval date.

## Data‑quality notes for the UI

- **Units are inconsistent in language:** German (`Prozent`, `Anzahl`, `Tage`,
  `kg`, `l`, `ha`, `Tsd. EUR`) and English (`persons`, `percent`, `points`,
  `dwellings`, `accidents`). The UI must map units → display labels in German
  (formatting only; see `docs/GLOSSARY.md`). This is a display concern, not an
  API gap.
- **Duplicate‑ish indicators by design:** e.g. Regionalatlas
  `arbeitslosenquote` vs BA `unemp_rate`. The UI must show source‑qualified
  names so users can tell them apart.
