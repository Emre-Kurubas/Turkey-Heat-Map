# Türkiye Suç Haritası — Design Spec

**Date:** 2026-08-01
**Status:** Approved for planning
**Package:** `turkiye-suc-haritasi`

---

## 1. Purpose

A drop-in React component that renders an interactive heat map of crime statistics
across Turkey, with filtering by year and crime category, drill-down from province
(il) to district (ilçe), comparison of two filter sets, and supporting charts.

It is a **library**, not an application. It is installed with `npm install` or
downloaded as a release zip from GitHub, and mounted inside a host site. It makes
no network requests, assumes no backend, and ships its own geography.

The entire user-facing interface is in Turkish.

---

## 2. Scope

### In scope

- Heat map of Turkey at il (81) and ilçe (973) levels
- Zoom-driven level switching, pan, fly-to-region
- Filtering by year range and crime category
- Turkish-aware smart search across il, ilçe, category, and year
- Hover tooltip with per-region detail
- Collapsible sidebar ranking regions at the current zoom level
- Category distribution pie chart
- 10-year trend line chart
- Comparison mode (filter set A vs filter set B, rendered as a diff)
- Per-panel enable/disable by the consumer; collapse/expand by the end user
- Full keyboard accessibility and screen-reader support
- Seeded mock dataset for development, tests, and documentation

### Out of scope

- Any network/data-fetching layer (consumer supplies data as a prop)
- Mahalle (neighborhood) level geography
- Individual crime incident records (data is pre-aggregated counts)
- Non-Turkish locales (the string table is overridable, but only `tr` ships)
- Server-side rendering of the map SVG (the component is client-only; it renders
  a static placeholder during SSR and hydrates)

### Explicit non-goal: "semt" level

The original brief asked for a `semt` zoom level. **Semt is not an official
administrative unit in Turkey** and has no authoritative boundary dataset. The
official hierarchy is İl → İlçe → Mahalle. This design implements İl and İlçe.
Mahalle is out of scope; if it is added later, it must be lazy-loaded per district
because the full national set is ~50,000 polygons.

---

## 3. Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Ships `.d.ts`; the prop contract is data-shape-heavy and must be checked at compile time by consumers |
| Framework | React 18/19 as **peer dependency** | Never bundle React into a library |
| Build | Vite library mode | ESM + CJS + types + one CSS file |
| Map rendering | Hand-built SVG | No tile server, no network, no API key, full control over the glass aesthetic |
| Runtime deps | `d3-geo`, `topojson-client` only | ~30 KB combined; everything else is hand-written |
| Charts | Hand-built SVG | Shares the map's color scale, formatting, and animation timing; avoids ~100 KB of Recharts whose defaults would be overridden anyway |
| Styling | CSS Modules → single `dist/style.css`, themed via CSS custom properties | Consumer retheming requires no rebuild and no specificity war |
| Unit/component tests | Vitest + React Testing Library | |
| E2E tests | Playwright | jsdom simulates hover, pointer events, and SVG transforms poorly — exactly the interactions that matter here |

---

## 4. Architecture

### 4.1 Layering

```
┌──────────────────────────────────────────────┐
│ components/   React. Rendering + interaction. │
├──────────────────────────────────────────────┤
│ hooks/        React. Stateful behaviour.      │
├──────────────────────────────────────────────┤
│ context/      React. One reducer store.       │
├──────────────────────────────────────────────┤
│ core/         PURE. No React. No DOM.         │
└──────────────────────────────────────────────┘
```

The rule that keeps this maintainable: **`core/` never imports React and never
touches the DOM.** All aggregation, color math, projection math, search matching,
and formatting live there as pure functions. They are exhaustively unit-tested
without rendering anything, and they can be reasoned about in isolation.

If a piece of logic is hard to test because it needs a rendered component, that is
a signal it belongs in `core/`.

### 4.2 Folder structure

```
turkiye-suc-haritasi/
├─ src/
│  ├─ index.ts                       # the entire public API surface
│  │
│  ├─ core/                          # PURE — no react, no DOM
│  │  ├─ types/
│  │  │  ├─ data.ts                  # CrimeRecord, CrimeCategory, RegionMeta
│  │  │  ├─ filters.ts               # FilterSet, CompareState
│  │  │  ├─ view.ts                  # ViewState, GeoLevel, Transform
│  │  │  └─ index.ts
│  │  ├─ aggregation/
│  │  │  ├─ buildIndex.ts            # records → queryable index
│  │  │  ├─ rollup.ts                # totals by region / year / category
│  │  │  ├─ diff.ts                  # A vs B deltas
│  │  │  └─ rank.ts                  # sidebar ordering + share-of-total
│  │  ├─ color/
│  │  │  ├─ interpolate.ts           # OKLab interpolation between stops
│  │  │  ├─ scales.ts                # spectral, blueRed, diverging-diff
│  │  │  ├─ domain.ts                # linear | log | quantile domains
│  │  │  └─ legend.ts                # legend break computation
│  │  ├─ geo/
│  │  │  ├─ projection.ts            # Turkey-tuned equal-area projection
│  │  │  ├─ topology.ts              # TopoJSON → features, memoized
│  │  │  ├─ bounds.ts                # bbox, centroid, fit-to-region
│  │  │  └─ viewport.ts              # visible-feature culling
│  │  ├─ search/
│  │  │  ├─ normalize.ts             # Turkish-aware casefolding + diacritics
│  │  │  ├─ index.ts                 # searchable entity index
│  │  │  ├─ match.ts                 # prefix + fuzzy scoring
│  │  │  └─ rank.ts                  # cross-entity result ordering
│  │  └─ format/
│  │     ├─ number.ts                # tr-TR grouping, compact notation
│  │     ├─ percent.ts
│  │     └─ delta.ts                 # signed change formatting
│  │
│  ├─ context/
│  │  ├─ HeatMapStore.ts             # reducer + external store
│  │  ├─ HeatMapProvider.tsx
│  │  └─ selectors.ts                # memoized derived state
│  │
│  ├─ hooks/
│  │  ├─ useHeatMapState.ts          # selector-based subscription
│  │  ├─ useMapZoom.ts               # pan/zoom transform + level derivation
│  │  ├─ useHoverTarget.ts           # hover state, deliberately outside store
│  │  ├─ useSearchIndex.ts
│  │  ├─ useAggregates.ts            # memoized rollups for current filters
│  │  ├─ useFlyTo.ts                 # animated viewport transitions
│  │  ├─ useReducedMotion.ts
│  │  └─ useResizeObserver.ts
│  │
│  ├─ components/
│  │  ├─ CrimeHeatMap/               # root: provider + layout orchestration
│  │  ├─ MapCanvas/
│  │  │  ├─ MapCanvas.tsx            # <svg>, transform group, event wiring
│  │  │  ├─ MapDefs.tsx              # blur filter, clip path, gradients
│  │  │  ├─ HeatLayer.tsx            # blurred region fills
│  │  │  ├─ BorderLayer.tsx          # crisp non-scaling strokes
│  │  │  ├─ HitLayer.tsx             # transparent pointer targets
│  │  │  └─ SelectionLayer.tsx       # focus ring, active region highlight
│  │  ├─ Sidebar/
│  │  ├─ SearchBar/
│  │  ├─ FilterBar/
│  │  ├─ CompareBar/
│  │  ├─ CategoryPieChart/
│  │  ├─ TrendChart/
│  │  ├─ HoverTooltip/
│  │  ├─ Legend/
│  │  ├─ DebugOverlay/
│  │  └─ primitives/                 # GlassPanel, Chip, Toggle, RangeSlider,
│  │                                 # Skeleton, IconButton, ErrorBoundary
│  ├─ i18n/
│  │  ├─ tr.ts                       # every user-facing string
│  │  └─ types.ts                    # Strings interface for overrides
│  ├─ data/
│  │  ├─ geo/
│  │  │  ├─ turkiye-il.topo.json
│  │  │  ├─ turkiye-ilce.topo.json
│  │  │  └─ region-meta.ts           # codes, names, parent links
│  │  └─ mock/
│  │     ├─ generate.ts              # seeded generator
│  │     └─ categories.ts
│  └─ styles/
│     ├─ tokens.css                  # CSS custom properties
│     └─ base.css
├─ playground/                       # Vite dev app, not published
├─ tests/
│  ├─ e2e/
│  └─ fixtures/
├─ docs/
└─ scripts/
   ├─ build-geo.ts                   # source shapefiles → simplified TopoJSON
   └─ pack-release.ts                # dist → GitHub release zip
```

**File size discipline:** any component file over ~200 lines is a signal to split.
`MapCanvas` is decomposed into layers for exactly this reason.

---

## 5. Data contract

### 5.1 Input shape

```ts
interface CrimeRecord {
  year: number;          // 2015
  ilCode: string;        // "34"   — official plaka code, zero-padded
  ilceCode?: string;     // "3401" — TÜİK district code; omit for il-only data
  category: string;      // category id, matches CrimeCategory.id
  count: number;         // non-negative integer
}

interface CrimeCategory {
  id: string;            // "hirsizlik"
  label: string;         // "Hırsızlık"
  color?: string;        // optional override for the pie chart
}

interface RegionPopulation {  // optional — unlocks per-capita mode
  ilCode: string;
  ilceCode?: string;
  year: number;
  population: number;
}
```

Records are **pre-aggregated counts**, not individual incidents. This matches how
TÜİK and EGM publish, and keeps the payload tractable: 973 ilçe × 10 years ×
8 categories ≈ 78,000 rows.

### 5.2 Derived data

İl-level totals are rolled up from ilçe records at load time and memoized. The
consumer never supplies the same number at two levels. If a dataset contains no
`ilceCode` on any record, ilçe zoom is disabled rather than rendering empty
regions, and the sidebar stays at il level.

### 5.3 Validation

On mount, and on every `data` prop identity change, records are validated in
`core/aggregation/buildIndex.ts`:

- unknown `ilCode` / `ilceCode` → record dropped, collected into a warning
- unknown `category` → record dropped, collected into a warning
- negative or non-integer `count` → record dropped
- duplicate `(year, region, category)` keys → summed, with a warning

Warnings are emitted once as a single grouped `console.warn` under the
`[heatmap]` namespace and surfaced in the debug overlay. **Invalid data never
throws** — a library that crashes a host page over one malformed row is
unacceptable. An `onDataWarning` callback lets the consumer forward them.

### 5.4 Geography source and licensing

Boundary data is derived from OpenStreetMap administrative relations, processed by
`scripts/build-geo.ts` into simplified TopoJSON. OSM data is **ODbL-licensed and
requires attribution**, so the package ships a mandatory attribution string
rendered in the map corner (styleable, not removable).

Target sizes after simplification: il ≈ 90 KB, ilçe ≈ 260 KB, both gzipped in
transit. Feature `id` fields must match the `ilCode` / `ilceCode` domain exactly;
`scripts/build-geo.ts` fails the build if any region code is unmatched in either
direction.

> **Confirm before implementation:** if the site has a license for official
> HGM/TÜİK boundary data, that source is preferable and removes the ODbL
> attribution requirement. The build script is source-agnostic.

---

## 6. Visual design

### 6.1 Layout

The map is full-bleed. Panels float above it as glass surfaces rather than
occupying grid cells — this is what keeps the layout uncluttered while still
showing five panels.

```
┌───────────────────────────────────────────────────────┐
│  ┌─ SearchBar ──────┐ ┌ Filters ┐        ┌─ Pie ────┐ │
│  └──────────────────┘ └─────────┘        │          │ │
│ ┌────────┐                               └──────────┘ │
│ │        │                                            │
│ │Sidebar │            M A P                           │
│ │        │                            ┌─ Trend ─────┐ │
│ └────────┘                            │             │ │
│  ┌─ Legend ─┐          [attribution]  └─────────────┘ │
└───────────────────────────────────────────────────────┘
```

When compare mode is active, a `CompareBar` slides down from the top center
holding filter set B. Nothing else moves.

Panels are positioned by CSS grid areas with `pointer-events: none` on the
overlay container and `pointer-events: auto` on each panel, so the map remains
draggable in the gaps between panels.

**Responsive:** below 1024 px the sidebar becomes a bottom sheet and the pie and
trend panels collapse into a single swipeable card stack. Below 640 px only the
map, search, and a compact legend show by default.

### 6.2 Glassmorphism tokens

```css
--hm-glass-bg:        rgba(255, 255, 255, 0.06);
--hm-glass-border:    rgba(255, 255, 255, 0.12);
--hm-glass-blur:      20px;
--hm-glass-shadow:    0 8px 32px rgba(0, 0, 0, 0.24);
--hm-radius:          16px;
```

`backdrop-filter` has no effect in some embedded webviews; panels therefore carry
a solid fallback background so text contrast is never dependent on the blur
rendering. Contrast is verified against both light and dark map regions.

### 6.3 Heat rendering

Three stacked SVG layers inside a single `<svg>`:

1. **HeatLayer** — region fills passed through `feGaussianBlur`, clipped to the
   national outline. This produces the diffused bleed from the reference image.
   `stdDeviation` scales as `baseBlur / k` so perceived softness is constant
   across zoom levels.
2. **BorderLayer** — white strokes with `vector-effect: non-scaling-stroke`, so
   borders stay hairline at any zoom.
3. **HitLayer** — fully transparent paths carrying all pointer events. Hover is
   therefore pixel-accurate against true boundaries even though the visible color
   is blurred across them.

**Critical performance property:** pan and zoom are a `transform` on the parent
group. The blur filter re-runs only when data, filters, or level change — never
on pointer movement. This is the difference between the map feeling instant and
feeling sluggish.

`heatStyle="flat"` skips the blur filter entirely and renders solid fills.

### 6.4 Projection

`d3.geoConicEqualArea().parallels([37, 41]).rotate([-35, 0])`, fit to the
viewport via `fitExtent`. **Equal-area is a correctness requirement, not a
preference:** a choropleth encodes magnitude by color over area, and a projection
that distorts area systematically misleads the reader about how much of the
country is affected.

### 6.5 Color scale

Interpolation happens in **OKLab**, not sRGB, so the gradient has no muddy bands
between stops.

- `spectral` (default): blue → cyan → green → yellow → orange → red
- `blueRed`: blue → pale → red, no green; more legible for the common color
  vision deficiencies
- custom: consumer passes `(t: number) => string`

**Domain mode defaults to `quantile`.** Turkish crime counts are extremely
right-skewed — İstanbul dwarfs everything — and a linear domain would render 78
provinces in indistinguishable blue. Quantile breaks spread the palette across
the actual distribution. `linear` and `log` are available via the `scaleMode`
prop, and the legend always states which mode is active, because a quantile map
answers "how does this rank" while a linear map answers "how many", and conflating
them is a real analytical error.

Domains are computed **per level** — il and ilçe magnitudes differ by an order of
magnitude and must not share a scale.

Because no rainbow scale is fully colorblind-safe, **numbers are always displayed
alongside color** in the tooltip, sidebar, and legend. Color is a summary; the
number is the source of truth.

### 6.6 Per-capita mode

If the consumer supplies `population`, a `Nüfusa göre` toggle appears in the
filter bar and the metric switches to crimes per 100,000 residents. Without
population data the toggle is not rendered. Raw counts make every population
center red, which is often not the question the reader is asking.

### 6.7 Motion

| Interaction | Duration | Easing |
|---|---|---|
| Hover highlight | 120 ms | `ease-out` |
| Panel collapse/expand | 240 ms | `cubic-bezier(.16,1,.3,1)` |
| Filter change → color transition | 400 ms | `ease-in-out` |
| Fly-to-region | 600 ms | `cubic-bezier(.4,0,.2,1)` |
| Level crossfade (il ↔ ilçe) | 300 ms | `ease-in-out` |

All durations collapse to 0 under `prefers-reduced-motion: reduce`. Fly-to becomes
an instant jump; the crossfade becomes a swap.

---

## 7. Component behaviour

### 7.1 Zoom and level switching

Zoom scale `k` ranges from 1 to 12. `k < 2.5` renders il; `k ≥ 2.5` renders ilçe,
with a 300 ms crossfade and hysteresis (±0.15) so scrolling across the threshold
does not flicker. At ilçe level, `core/geo/viewport.ts` culls polygons outside the
visible bounds.

The sidebar list, color domain, tooltip content, and search result weighting all
follow the active level.

### 7.2 Hover tooltip

Follows the cursor at a 12 px offset, flipping horizontally and vertically near
viewport edges so it is never clipped. Contents: region name, total for the
current filters, top three categories with proportional mini-bars, and
year-over-year change. Appears after a 60 ms delay to avoid flicker during fast
traversal; hides immediately on pointer-out.

Hover state lives in a dedicated store outside the main reducer, so pointer
movement re-renders the tooltip alone — not the pie chart, sidebar, and trend
panel.

### 7.3 Sidebar

Ranked list of regions at the current level: name, count, share of national total,
and a proportional bar tinted with that region's heat color. Sortable by count or
name. Clicking a row flies the map to that region; hovering a row highlights it on
the map, and vice versa. Collapses to a 48 px rail with an icon-only toggle.

Virtualized at ilçe level (973 rows) — hand-rolled windowing, no dependency.

### 7.4 Search

One input searching four entity types simultaneously, grouped in the results
dropdown: İl, İlçe, Suç Türü, Yıl.

Turkish handling is the hard part and is unit-tested adversarially. Normalization
must map `İ→i`, `I→ı`, `ş→s`, `ç→c`, `ğ→g`, `ö→o`, `ü→u`, `ı→i` for matching
purposes, so `sisli` finds `Şişli`, `agri` finds `Ağrı`, and `istanbul` finds
`İstanbul`. Naive `toLowerCase()` breaks on the dotted/dotless İ/I pair and must
not be used.

Matching is prefix-first, then fuzzy (bounded edit distance), scored and ranked
across entity types. Selecting a location flies the map there; selecting a
category or year applies it as a filter. Fully keyboard-driven with arrow keys,
Enter, and Escape.

### 7.5 Filters

Year range (dual-handle slider over the data's actual year span) and crime
category multi-select chips. A `Sıfırla` action clears to defaults. Filter changes
recompute every panel through memoized selectors — under the performance budget in
§9, no loading state is needed.

### 7.6 Compare mode

The `Karşılaştır` toggle reveals filter set B in the `CompareBar`. The map
switches to the diverging diff scale: red = increase relative to B, blue =
decrease, pale = unchanged. The legend switches to a centered diverging ramp
labeled with signed values. The pie chart shows paired arcs; the trend chart
overlays both series with B dashed. The tooltip shows A, B, absolute delta, and
percentage delta.

Turning compare off restores the single-set view with a 400 ms color transition.
The layout never changes shape.

### 7.7 Charts

**CategoryPieChart** — donut, category share for the current filters and selected
region (national when nothing is selected). Slices animate on filter change;
hovering a slice highlights the corresponding chip in the filter bar. Categories
below 3% collapse into `Diğer`, expandable on click.

**TrendChart** — line chart, x = year, y = crime count, over the data's full year
span. Shaded area under the line. Hovering shows a vertical guide and a value
label. The active filter range is highlighted, the rest dimmed, so the selection
is always visible in context. Clicking a year sets the filter to that year.

Both use the same tr-TR number formatting and color scale as the map.

### 7.8 Panel control

```ts
panels?: {
  sidebar?: boolean; search?: boolean; filters?: boolean;
  pie?: boolean; trend?: boolean; legend?: boolean;
  compare?: boolean; tooltip?: boolean;
}
```

Every panel defaults to `true`. `false` means the panel never mounts — no hidden
DOM, no wasted computation. Panels that are enabled are additionally collapsible
by the end user, with state persisted to `localStorage` under a namespaced key
(disableable via `persistUiState={false}`).

The map always renders; it is the component's reason to exist.

---

## 8. Public API

```tsx
import { CrimeHeatMap } from 'turkiye-suc-haritasi';
import 'turkiye-suc-haritasi/style.css';

<CrimeHeatMap
  data={records}                    // CrimeRecord[]           (required)
  categories={categories}           // CrimeCategory[]         (required)
  population={populations}          // RegionPopulation[]      (optional)

  panels={{ sidebar: true, pie: true, trend: true, compare: true }}
  defaultFilters={{ yearRange: [2015, 2024], categories: [] }}
  defaultView={{ level: 'il', focusedIl: null }}

  colorScale="spectral"             // | "blueRed" | (t) => string
  scaleMode="quantile"              // | "linear" | "log"
  heatStyle="glow"                  // | "flat"
  metric="total"                    // | "perCapita"

  strings={customStrings}           // Partial<Strings> override
  theme={{ glassBlur: '24px' }}     // CSS custom property overrides
  className="" style={{}}

  debug={false}
  persistUiState

  onRegionClick={(region) => {}}
  onRegionHover={(region | null) => {}}
  onFiltersChange={(filters) => {}}
  onViewChange={(view) => {}}
  onDataWarning={(warnings) => {}}
  onError={(error) => {}}
/>
```

**Prop reconciliation rules** (each has exactly one defined behavior, no
ambiguity):

- `defaultFilters.yearRange` is clamped to the year span actually present in
  `data`. A range entirely outside the data's span falls back to the full span
  and emits a data warning.
- `defaultFilters.categories` entries not present in `categories` are dropped
  with a warning.
- `metric="perCapita"` without a `population` prop falls back to `"total"`,
  emits a warning, and does not render the toggle.
- `defaultView.level="ilce"` on a dataset with no `ilceCode` falls back to
  `"il"`.
- `data` and `categories` are compared by reference identity; the aggregation
  index rebuilds only when that identity changes. Consumers must not construct
  these arrays inline in render.

Also exported: the `core/` pure functions (`aggregate`, `normalizeTurkish`,
`createColorScale`, `formatTrNumber`), all TypeScript types, the `trStrings`
table, and `generateMockData` for consumers building demos.

The component is wrapped in an internal error boundary. A rendering failure shows
a Turkish fallback message inside the component's own box and calls
`onError` — it never takes down the host page.

---

## 9. Performance

| Budget | Target |
|---|---|
| Initial render, 78k records | < 500 ms |
| Filter change → all panels updated | < 100 ms |
| Pan / zoom | 60 fps sustained |
| Hover → tooltip visible | < 16 ms |
| Bundle, gzipped, excluding geo | < 60 KB |
| Geo payload, gzipped | < 120 KB |

Techniques: a pre-built aggregation index keyed by `(level, year, category)`;
memoized selectors so unrelated panels never recompute; hover state isolated from
the main store; viewport culling at ilçe level; blur filter re-run only on data
change; `content-visibility: auto` on offscreen panels; and geometry simplified
per level rather than shipping full-resolution polygons for the country view.

These budgets are asserted in Playwright performance tests, not just documented.

---

## 10. Accessibility

Treated as correctness, not polish.

- Map regions are focusable and arrow-key navigable in reading order; Enter
  selects, Escape returns to the country view
- Each region carries `role="img"` with an `aria-label` stating name and value
- The tooltip mirrors into an `aria-live="polite"` region so screen readers
  announce hover and focus targets
- All panels are keyboard-operable; focus is trapped correctly in the search
  dropdown and released on Escape
- Visible focus rings that survive the glass backdrop
- Numbers accompany color everywhere (§6.5)
- `prefers-reduced-motion` respected throughout
- Contrast verified against both the lightest and darkest map regions
- Automated axe checks run in the E2E suite

---

## 11. Testing strategy

### 11.1 Unit — Vitest, on `core/`

Every pure function, with emphasis on:

- **Turkish normalization**, adversarially: `İstanbul` / `istanbul` / `ISTANBUL` /
  `ıstanbul` / `Istanbul`; `sisli`→`Şişli`; `agri`→`Ağrı`; `corum`→`Çorum`;
  `gumushane`→`Gümüşhane`; and the `I`/`ı`/`İ`/`i` casing trap that breaks naive
  `toLowerCase()`
- **Aggregation**: empty data, single record, duplicate keys, missing years,
  regions with zero crimes, ilçe-less datasets
- **Color scales**: domain edges, all-equal values, single distinct value,
  quantile with fewer values than buckets, `t` outside `[0,1]`
- **Diff**: A empty, B empty, both empty, zero-to-nonzero (division by zero in
  percentage delta)
- **Geo**: unmatched codes, projection determinism, bbox of a multipolygon
- **Formatting**: tr-TR grouping (`1.234.567`), compact notation, signed deltas

Target: 100% branch coverage on `core/`, enforced in CI.

### 11.2 Component — Vitest + RTL

Each panel in isolation across empty, loading, single-region, missing-data, and
error states. Panel enable/disable matrix. Reducer transitions. Callback firing.
Strings-override behavior. Verification that disabled panels produce no DOM.
Every prop reconciliation rule in §8 gets an explicit test, including the
error boundary catching a forced child failure without propagating.

### 11.3 E2E — Playwright

Real browser, real pointer events:

- Hover a region → tooltip shows the correct number
- Zoom past threshold → level switches, sidebar content changes
- Search `sisli` → dropdown shows Şişli → select → map flies there
- Change filters → map, sidebar, pie, and trend all update consistently
- Compare mode → diff colors correct in both directions
- Toggle each panel off → layout reflows without gaps
- Full keyboard traversal of map and panels
- axe accessibility scan on the default and compare views
- Performance assertions against the §9 budgets

### 11.4 Debugging support

`debug={true}` mounts a `DebugOverlay` showing render counts per component,
aggregation timings, active filter/view state, data validation warnings, visible
feature count, and FPS. A namespaced `[heatmap]` logger with levels is compiled
out of production builds via a `NODE_ENV` guard.

The mock generator is seeded, so every test and every screenshot is reproducible
from a seed — no `Math.random()` anywhere in the test path.

---

## 12. Packaging

```jsonc
{
  "name": "turkiye-suc-haritasi",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".":          { "types": "./dist/index.d.ts",
                    "import": "./dist/index.mjs",
                    "require": "./dist/index.cjs" },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" }
}
```

`scripts/pack-release.ts` produces a GitHub-release zip containing `dist/`, the
README, and a minimal standalone example, so the component can be dropped into a
project without npm.

Documentation ships as a Turkish README (installation, quick start, full prop
table, theming, data shape, FAQ) plus the `playground/` app as a living example.

---

## 13. Implementation phases

Each phase ends with a working, tested, demonstrable state.

1. **Foundation** — repo, TypeScript, Vite lib build, test harness, all `core/`
   pure modules with full unit tests, seeded mock generator, geo build script.
   *Nothing renders yet; everything is provably correct.*
2. **Map** — `MapCanvas` with all three layers, projection, zoom/pan, level
   switching, legend, hover tooltip. *A working heat map.*
3. **Panels** — sidebar, search, filter bar, pie chart, trend chart, panel
   toggling, layout reflow, responsive behavior.
4. **Compare** — filter set B, diff scale, diff-aware charts and tooltip.
5. **Polish & release** — animation pass, accessibility audit, debug overlay,
   E2E suite, performance assertions, docs, packaging, release zip.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| SVG blur over 973 paths is slow on low-end devices | Blur runs only on data change, never on pan; `heatStyle="flat"` is a documented escape hatch; performance asserted in CI |
| Boundary data licensing (ODbL attribution) | Attribution baked in and non-removable; build script is source-agnostic if licensed official data is available |
| Region codes in geo data may not match the consumer's dataset | Build script fails on any unmatched code; runtime validation warns instead of throwing; codes documented in the README |
| Rainbow scale misleads colorblind readers | Numbers always shown alongside color; `blueRed` scale available; documented in the README |
| Quantile scaling can be misread as absolute magnitude | Legend always states the active scale mode |
| 973-row sidebar jank | Hand-rolled virtualization, covered by performance tests |
| `backdrop-filter` unsupported in some webviews | Solid fallback background guarantees text contrast |

---

## 15. Open item requiring confirmation

Boundary data source (§5.4): OSM-derived with ODbL attribution, unless official
HGM/TÜİK data is licensed for this site. This does not block Phase 1.
