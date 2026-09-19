# Design plan — BundesPulse restyle (visual layer only)

Visual redesign of an already-functional read-only React SPA. No architecture,
logic, data, routing, props or copy change. Only Tailwind config, global CSS,
theme/palette values and `className` strings.

---

## 1. Current visual system (inventory)

- **Tokens:** shadcn-style HSL custom properties in `src/index.css` (`:root` +
  `.dark`), mapped in `tailwind.config.js` (`background, foreground, card,
  popover, primary, secondary, muted, accent, destructive, border, input,
  ring`). Radius `--radius: 0.5rem`, `darkMode: ["class"]`,
  `tailwindcss-animate` installed. Container centred with 20/24/32px padding.
- **Primitives** (`components/ui/`): `Card` = `rounded-xl border bg-card shadow`;
  `Button` = `rounded-md` + default/outline/ghost/secondary/destructive/link,
  sizes sm/default/lg/icon; `Badge` = `rounded-md` + variants. Nothing else.
- **Typography:** default Tailwind system stack; sizes in use: `text-3xl`
  (page titles + KPI values), `text-base`, `text-sm`, `text-xs`; weights
  400/500/600. `tabular-nums` used in only ~11 spots; `uppercase tracking-wide`
  on labels in **15** places; `tracking-tight` on titles.
- **Controls:** `Select` = `rounded-md border shadow-sm`; `Segmented` =
  `rounded-md border bg-muted/40 p-0.5`; links/buttons use soft `ring` shadows.
- **Tables** (`data-table.tsx`): `text-sm`, `px-3 py-2` (dense `py-1.5`), header
  `font-medium text-muted-foreground border-b`, rows `border-b hover:bg-muted/40`.
- **Charts:** inline ECharts options per page; default chart typography/grid;
  series colours = inline hex (`#1d4f8a`, `#64748b`, `#94a3b8`, `#c3d5ec`).
  No shared ECharts theme.
- **Map** (`regions-map.tsx`): own 8-step blue `RAMP`, `NO_DATA_FILL #e6e8ec`,
  background `#fafbfc`, white outlines, hover `#0f2a52`; popup styled light in
  `index.css` (`.bp-popup`).
- **Structure:** sections separated ad-hoc with `border-t pt-8` (pages) vs
  `Card` chrome (home/methodology/placeholder chart); filter bars `border-b pb-4`.
- **Dark mode:** mechanical inversion of the same hues; map popup and map
  background stay light; chart colours unchanged.

## 2. Biggest visual problems

1. **Generic-generated tells.** ALL-CAPS tracked eyebrows everywhere
   (`PageHeader` + 15 labels); uniform `rounded-xl` cards with one shadow;
   default shadcn blue (`hsl(221 83% 53%)`) reads SaaS, not a statistical service.
2. **Weak type hierarchy.** Only three real levels (`3xl / sm / xs`); page titles
   and KPI numbers are the same size, so nothing leads. Body/measure undefined.
3. **Weak number presentation.** Tabular figures applied ad hoc instead of
   globally; KPI deltas use `emerald/destructive`; columns don't reliably align.
4. **Fragmented data colours.** Sequential ramp only on the map; comparison
   pages use unrelated inline hex (`#0d9488 #c2410c #7c3aed`); no diverging scale
   for "vs. Deutschland"; no proper no-data treatment beyond one grey; meaning
   risks resting on hue alone.
5. **Charts look framework-default.** No shared axis/gridline/tooltip theme;
   three different label greys across pages.
6. **Dark mode is an inversion, not a design.** Light map popup/background on dark
   basemap; ramps unreadable; borders too low-contrast.
7. **Uniform soft chrome.** Every control is `rounded-md + shadow-sm`; filter bars
   repeat the same pill row; radius used identically everywhere.
8. **Separation is inconsistent.** Some sections use hairlines, some cards, some
   nothing — no single rule for how structure is expressed.
9. **Tables are functional, not analytical.** Default type/row rhythm, hover-only
   affordance, header alignment mixed; no compact/analyst feel.
10. **Weak responsive tuning.** Fixed `h-[540px]` map, `text-3xl` KPIs and filter
    rows rely on defaults at 360–768px.
11. **Accessibility detail.** Soft ring shadows instead of strong focus outlines;
    low-contrast footer/muted-60 text.

## 3. Proposed visual direction

**A civic instrument.** The data is the star: paper-white ground, near-black ink,
one deep flag red as the only interactive accent with gold as a secondary
highlight, hairline rules doing the structuring (not cards), and a deliberate
*figure* treatment as the single place of visual risk — large, tabular, tightly
tracked numbers. Charts and the map share one data-colour system that is visibly
separate from the UI chrome. Restrained, precise, trustworthy; nothing that reads
as startup/marketing/AI.

---

## 4. Palette

German civic palette — **schwarz–rot–gold**. This is defined as much by *where*
each colour sits as by the hues: **black is structure** (ink, focus, footer
band, one stat accent), **red is the interactive accent** (links, buttons,
active/selected state, the first flag band), **gold is highlight** (secondary
stat accents, legend, the last flag band), all on **paper white**.

### Base UI
| Token | Hex | Use | Placement / rationale |
|---|---|---|---|
| **paper** | `#FFFFFF` | page background | crisp, official; flag colours stay true on white |
| **ink** | `#0A0A0A` | text, focus ring, footer band | flag black as structure, not just text |
| **muted-ink** | `#595959` | captions, sources, secondary | neutral grey, AA on white |
| **line** | `#E2E2E2` | borders, rules, gridlines | quiet neutral structure |
| **red** | `#C1121F` | links, primary buttons, active/selected | flag red, deepened for AA on white |
| **gold** | `#F5C400` | stat accents, unit charts, flag band | flag gold; never body text |
| **accent-weak** | `#FFF0C2` | hover fills (outline/ghost buttons, list rows) | pale gold, black text |

`--flag-black #0A0A0A`, `--flag-red #C1121F`, `--flag-gold #F5C400` are named
tokens. Radius `--radius: 0.375rem` (6px).

### Schwarz–rot–gold motif
One recurring band, `.bp-flag` (three equal segments, in flag order), placed
deliberately and nowhere else:
- **top edge of the site header** (the page opens on the flag),
- **under the home hero title** (replaces a plain accent rule),
- **top edge of the footer**, which is a **black band** — so the page is framed
  black/red/gold top and bottom,
- the **logo mark** (a small stacked flag).

The four home stat cards also read in flag order — **01 black, 02 red, 03 gold**
— with **04 neutral grey** for the snapshot meta.

### Data palette (separate from UI; colour-blind safe)
- **Sequential (map/chart), 7 steps:** `#FFF7D6 #FCE999 #F7D24A #E8A200 #D3601C #C1121F #7A0008`
  (gold → flag red → deep red). This is the flag gradient, so the map itself
  carries the national identity.
- **Diverging “vs. Deutschland”, 7 steps (neutral midpoint at the national value):**
  `#8A5A00 #C98A10 #F3D168 #F2F2F2 #EFA9A9 #D05252 #8B0000`.
- **Qualitative (categories, compared regions), ≤8:**
  `#C1121F #E8A200 #2E6E68 #7A4A6B #2E7D74 #B5561B #6E7A2E #111111`.
- **No data:** `#CFCFCF`, drawn with a 45° hatch
  (`repeating-linear-gradient`), always present in legends.

Rationale: the gold↔red ramp keeps the flag identity while staying safe for
red-green CVD; meaning is never hue-only — class breaks, labels and the hatch
carry it too.

## 5. Typography

- **One family** (no new dependency): tuned system stack —
  `ui-sans-serif, "Segoe UI Variable Text", "Segoe UI", Inter, system-ui,
  -apple-system, "Helvetica Neue", Arial, sans-serif`.
- **Roles:** figures use the same family; **no monospace** decoration.
- **Figures:** `font-variant-numeric: tabular-nums lining-nums` applied globally
  on `body`, so every number aligns on the decimal; large figures get
  `letter-spacing: -0.01em`.
- **Measure:** prose blocks capped at ~72ch.

## 6. Type scale

| Role | Size / line-height | Weight |
|---|---|---|
| display (region name) | 34 / 40 | 600 |
| page title (h1) | 26 / 32 | 600 |
| section heading (h2) | 18 / 26 | 600 |
| block/chart title (h3) | 14 / 20 | 600 |
| body | 14 / 22 | 400 |
| metadata (captions, axes) | 12.5 / 18 | 400 |
| numeric value (KPI) | 30 / 34 | 600, tabular, -0.01em |
| table cell / figure | inherit | 400–500, tabular |

## 7. Spacing

Keep the 4px Tailwind scale. Page vertical rhythm: top `py-8`, section gap
`space-y-10`, block header `mb-3`, control row gap `gap-3/4`, table cell
`px-3 py-2` (comfortable) / `py-1.5` (compact). No oversized whitespace;
comfortable when browsing, compact in tables/rankings.

## 8. Radius

`--radius: 0.375rem` (6px). Used on interactive controls (buttons, selects,
segmented, badge, inputs) and the rare bounded panel (map controls). **Deliberately
not** applied to content blocks: pages/table panels/stat blocks are separated by
rules and whitespace, not rounded cards, removing the “identical rounded cards”
tell.

## 9. Borders

Hairlines (`--line #E2E2E2`, 1px) are the primary structuring device: section
top rules, table header/row separators, filter-bar rule, footer rule. Panels that
truly need a boundary get a 1px border with no shadow.

## 10. Shadows

Only two uses: (a) overlay surfaces that float above content (map popup, select
dropdown menu) get one soft shadow (`0 4px 14px rgb(10 10 10 / .14)`);
(b) none anywhere else. Cards/stat blocks lose `shadow`/`shadow-sm` entirely.

## 11. Charts (ECharts)

One shared visual treatment across all pages (values passed as options where they
already live — no component change):
- Gridlines/borders: `--line`; axis labels `--muted-ink` at 12.5px, tabular.
- Tooltip: paper surface, 1px `--line`, 6px radius, soft shadow, `de-DE`
  formatting (unchanged logic).
- Series colours from the data palette: single-series = sequential end
  `#C1121F`; region-vs-DE = accent + `--muted-ink` reference line; multi-region =
  qualitative flag-led set, one stable colour per region across the page.
- No decorative gradients, no 3D, no default-theme fonts.

## 12. Maps (MapLibre)

- Light: backdrop `--surface`; outlines white 0.6px; fill = sequential ramp;
  hover = `#000000` at ~16% overlay; no-data = `#CFCFCF` hatch.
- Popup (`.bp-popup`): paper/ink; 6px radius; soft shadow; tabular figures; rank
  line in `--muted-ink`.
- Legend: uses the same ramp/hatch; no-data swatch always shown when present.

## 13. Tables

Analytical treatment: header micro-caps? **no** — sentence-case `--muted-ink`
13px, 1px bottom rule; numeric columns right-aligned and tabular so decimals
align; row hover `--surface` (subtle); comfortable/compact via existing `dense`;
no zebra stripes (rules suffice); container overflow unchanged.

## 14. Colour mode

**Light only.** The German palette is tuned for a paper-white ground and is the
single supported mode; there is no `prefers-color-scheme` override and no `dark:`
variants. `color-scheme: light` is set on `:root`. Charts, maps, popups and
legends all use the light data ramps.

## 15. Responsive styling

- **360px:** single column; filter fields stack full-width; KPIs two-up; map
  height capped (~360px); tables scroll horizontally; type scale steps down one
  notch for display/title; no horizontal page scroll.
- **768px:** two-column KPI grids; filter bar wraps to two rows; charts full-width;
  map ~440px.
- **1280px:** content grid with a right rail where pages already define one;
  charts/table side-by-side as today; map ~540px.
- **1920px:** container capped (existing), comfortable gutters; no stretched
  line lengths; tables unaffected.

## 16. Motion

Minimal and purposeful: a 150ms colour transition on interactive elements, and
map/classification colour updates. No entrance animations, no hover lifts.
`@media (prefers-reduced-motion: reduce)` disables transitions/animations.

## 17. Accessibility floor

Tabular figures do not replace semantics. `:focus-visible` gets a 2px solid
`--ring` outline with 2px offset (replacing soft ring shadows). Text and
meaningful graphics meet WCAG AA in both modes; footer/muted text raised above
current low-contrast `muted-foreground/60`.

## 18. Files expected to modify (visual layer only)

- `apps/web/tailwind.config.js` — colour tokens (hex→HSL), fontFamily, radius.
- `apps/web/src/index.css` — `:root` values, base typography, global
  tabular figures, focus-visible, reduced-motion, `.bp-popup`, data-palette CSS vars.
- `apps/web/src/components/ui/{card,button,badge}.tsx` — `className` only.
- `apps/web/src/components/{page-header,kpi,filters,data-table,source-note,async-state,region-navigation,site-header,site-footer,regions-map}.tsx`
  — `className` and inline palette hex values only.
- `apps/web/src/pages/*.tsx` — `className` and inline chart palette hex values.
- `apps/web/src/components/echart.tsx` — **only if** a shared ECharts theme needs
  registering (visual config; no logic). Will confirm before touching.

No backend, API, pipeline, `lib/api.ts`, `lib/queries.ts`, routes, props, types,
copy, or dependencies were or will be changed.
