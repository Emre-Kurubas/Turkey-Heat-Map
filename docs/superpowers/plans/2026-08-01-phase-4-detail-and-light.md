# Türkiye Suç Haritası — Phase 4: Detail View and Light Theme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the component light, and make a region click open a detail panel — category list, donut and yearly trend — with the map still visible behind it.

**Architecture:** The theme change is a token swap plus two re-derived colour systems; nothing structural moves. The detail panel is driven by a `detail` slice in the store that deliberately survives a level change, because clicking a province both zooms to district level *and* opens that province's detail — and a target cleared by the zoom would close the panel it just opened.

**Tech Stack:** React 18/19 (peer dep), TypeScript, CSS Modules, Vitest + React Testing Library (jsdom), hand-built SVG charts.

## Global Constraints

Carried from the spec; every task inherits these.

- **`core/` never imports React and never touches the DOM.** Enforced by ESLint.
- **`core/` stays at 100% branch coverage.**
- **React is a peer dependency, never bundled.**
- **Runtime deps stay exactly `d3-geo` and `topojson-client`.**
- **No `Math.random()` anywhere in `src/`.**
- **Every user-facing string is Turkish** and comes from the `Strings` table.
- **All motion collapses to 0 under `prefers-reduced-motion: reduce`.**
- **Numbers always accompany colour** (§6.5).
- **Panels are independently mountable (§7.8):** `false` means the panel never mounts.
- **The map always renders.**
- **Equal-area projection is a correctness requirement** (§6.4).
- **Attribution is mandatory and non-removable** (§5.4).
- **tr-TR formatting comes from `core/format`** — never `toLocaleString`.

## Decisions already taken

Settled with the project owner before planning; do not revisit mid-task.

1. **Light theme, whole component.** Not a toggle — light is the only theme.
2. **Detail opens as a slide-in panel** over one side; the map stays visible and
   the region stays highlighted. Closing returns you to exactly where you were.
3. **Fixed panel positions at every window size.** The two responsive
   breakpoints added in Phase 3 are removed.

## Out of scope — already working

Verified in the browser before this plan was written; **do not rebuild**:

- The heat repaints when either the category or the year filter changes.
- The sidebar collapses to a rail and expands again.

## The two colour systems, re-derived

Both were tuned for a dark surface and neither survives the flip unchanged.
The values below are computed and verified, not picked by eye — treat them as
data, and if you change any of them, re-run the checks that produced them.

### Map ramp — `spectral`

The old ramp's lightness makes a **V**: dark blue at the low end, light yellow
in the middle, dark red at the top. On a dark canvas that reads fine, because
magnitude is carried by hue. On a light canvas the middle of that V — the teal,
green and yellow stops, which are exactly the mid-range values a reader most
needs to separate — drops to 2.00, 1.59 and 1.36 contrast against the surface
and effectively disappears.

The replacement keeps the spectral hue journey but solves each stop to a target
luminance, so magnitude reads by lightness **as well as** hue:

| stop | hex | luminance | contrast vs `#eef1f6` |
|---|---|---|---|
| 1 (lowest) | `#dbe6f4` | 0.782 | 1.11 |
| 2 | `#acd0ea` | 0.598 | 1.43 |
| 3 | `#5ac0cf` | 0.444 | 1.88 |
| 4 | `#39ab72` | 0.312 | 2.56 |
| 5 | `#9c7a16` | 0.210 | 3.56 |
| 6 | `#a14e12` | 0.131 | 5.13 |
| 7 (highest) | `#871d13` | 0.061 | 8.37 |

Luminance decreases strictly, and every adjacent pair differs by at least 1.28
in contrast — so consecutive steps are separable by lightness alone, not only by
hue. The lightest stop sits close to the surface on purpose: on a choropleth,
"near zero" is *supposed* to recede.

### Chart palette — categorical

Swap to the light-surface column and re-validate against the panel surface
(`#f7f8fa`). Result: every hard gate passes — lightness band, chroma floor,
adjacent CVD separation (worst ΔE 9.1), normal-vision floor (19.6) — with a
**contrast WARN** on three hues below 3:1 (`#1baf7a` 2.65, `#eda100` 2.04,
`#e87ba4` 2.53).

That warning is not dismissable, and it is already answered: the pie's legend
prints a label **and** a number beside every swatch, so no slice depends on
colour alone. Keep it that way — removing those labels would make the warning
a real defect.

## File Structure

```
src/
├─ core/
│  └─ color/scales.ts            # spectral + blueRed re-derived for light
├─ context/
│  └─ HeatMapStore.ts            # + detail slice, surviving level change
├─ hooks/
│  └─ useRegionDetail.ts         # rollup for the detail target, at its own level
├─ components/
│  ├─ RegionDetail/
│  │  ├─ RegionDetail.tsx        # slide-in panel shell
│  │  ├─ RegionCategoryList.tsx  # the left-hand category table
│  │  ├─ RegionDetail.module.css
│  │  └─ index.ts
│  └─ FilterBar/                 # + collapsed-to-a-button state
└─ styles/
   └─ tokens.css                 # light surfaces and ink
```

---

## Task 1: Light theme tokens

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/index.ts`
- Modify: `src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the same token names, with light values, plus `--hm-ink-inverse`
  for text that sits on a dark heat fill.

- [ ] **Step 1: Extend the token test**

Add to `src/styles/tokens.test.ts`:

```ts
describe('light theme', () => {
  it('uses a light map surface', () => {
    expect(css).toContain('--hm-map-bg: #eef1f6');
  });

  it('uses dark ink, since the surfaces are now light', () => {
    const fg = /--hm-fg:\s*([^;]+);/u.exec(css)?.[1] ?? '';
    // A light-on-light foreground is the classic failed theme flip.
    expect(fg).not.toMatch(/255,\s*255,\s*255/u);
  });

  it('draws region borders in dark ink rather than white', () => {
    const stroke = /--hm-border-stroke:\s*([^;]+);/u.exec(css)?.[1] ?? '';
    expect(stroke).not.toMatch(/255,\s*255,\s*255/u);
  });

  it('declares no dark-mode media query, since light is the only theme', () => {
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('keeps the reduced-motion block, which is not a theme concern', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/styles/tokens.test.ts`
Expected: FAIL — the map background is still `#0b1020`.

- [ ] **Step 3: Rewrite the tokens**

Replace the `:root` block in `src/styles/tokens.css`. Keep every token name —
only the values change, so no component needs touching:

```css
:root {
  /*
   * Glass on a light surface. The translucent fill is now a white wash over
   * the map rather than a dark one, and the border darkens: a white hairline
   * is invisible against a pale panel.
   */
  --hm-glass-bg: rgba(255, 255, 255, 0.72);
  --hm-glass-bg-solid: #f7f8fa;
  --hm-glass-border: rgba(15, 23, 42, 0.12);
  --hm-glass-blur: 20px;
  --hm-glass-shadow: 0 8px 32px rgba(15, 23, 42, 0.12);
  --hm-radius: 16px;

  /* Map surface */
  --hm-map-bg: #eef1f6;
  /*
   * Borders are dark now. White strokes over pale fills vanish, and the
   * boundaries are the only thing separating one region from its neighbour.
   */
  --hm-border-stroke: rgba(15, 23, 42, 0.45);
  --hm-border-width: 0.75;
  --hm-focus-ring: #b45309;
  /* Distinct from every ramp step: "no records" must not read as "near zero". */
  --hm-no-data: rgba(15, 23, 42, 0.06);

  /* Type */
  --hm-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --hm-fg: #0f172a;
  --hm-fg-muted: #64748b;
  /* For labels that land on a dark heat fill at the top of the ramp. */
  --hm-ink-inverse: #f8fafc;

  /* Motion — §6.7 */
  --hm-motion-hover: 120ms;
  --hm-motion-panel: 240ms;
  --hm-motion-color: 400ms;
  --hm-motion-fly: 600ms;
  --hm-motion-level: 300ms;
  --hm-ease-hover: ease-out;
  --hm-ease-panel: cubic-bezier(0.16, 1, 0.3, 1);
  --hm-ease-color: ease-in-out;
  --hm-ease-fly: cubic-bezier(0.4, 0, 0.2, 1);
  --hm-ease-level: ease-in-out;
}

/*
 * Motion is a preference the OS already answers. Zeroing the durations here
 * means no component has to branch on it in JS for CSS-driven transitions.
 */
@media (prefers-reduced-motion: reduce) {
  :root {
    --hm-motion-hover: 0ms;
    --hm-motion-panel: 0ms;
    --hm-motion-color: 0ms;
    --hm-motion-fly: 0ms;
    --hm-motion-level: 0ms;
  }
}
```

- [ ] **Step 4: Register the new token**

Add `'--hm-ink-inverse',` to `THEME_TOKEN_NAMES` in `src/styles/index.ts`,
after `'--hm-fg-muted'`. The token test holds the list and the stylesheet to
each other in both directions, so it fails until you do.

- [ ] **Step 5: Fix the hard-coded dark washes**

Several components hard-code `rgba(255, 255, 255, …)` for hover and pressed
states, which is invisible on a light surface. Replace each with a dark wash:

```bash
grep -rn "rgba(255, 255, 255" src --include="*.css"
```

In every match under `src/components/`, swap the white for `15, 23, 42` and
halve the alpha — a dark wash reads at lower opacity than a light one:

| before | after |
|---|---|
| `rgba(255, 255, 255, 0.08)` | `rgba(15, 23, 42, 0.05)` |
| `rgba(255, 255, 255, 0.1)` | `rgba(15, 23, 42, 0.06)` |
| `rgba(255, 255, 255, 0.14)` | `rgba(15, 23, 42, 0.09)` |
| `rgba(255, 255, 255, 0.16)` | `rgba(15, 23, 42, 0.12)` |
| `rgba(255, 255, 255, 0.3)` | `rgba(15, 23, 42, 0.24)` |

Two exceptions that are **not** hover washes and need their own values:

- `SearchBar.module.css` `.input` background `rgba(0, 0, 0, 0.25)` → `#ffffff`,
  since the field should read as an input on a light panel.
- `Attribution.module.css` background `rgba(0, 0, 0, 0.3)` →
  `rgba(255, 255, 255, 0.75)`, so the credit stays legible over the map.

- [ ] **Step 6: Run the tests and commit**

```bash
npx vitest run src/styles
npm run typecheck && npm run lint
```

Expected: PASS, 9 token tests.

```bash
git add src/styles src/components
git commit -m "feat(styles): convert the design tokens to a light theme"
```

---

## Task 2: Re-derive the map ramps for a light canvas

**Files:**
- Modify: `src/core/color/scales.ts`
- Modify: `src/core/color/scales.test.ts`

**Interfaces:**
- Consumes: `createRamp` from `core/color/interpolate`.
- Produces: `SPECTRAL_STOPS` and `BLUE_RED_STOPS` with light-surface values.
  Signatures unchanged — every caller keeps working.

- [ ] **Step 1: Write the failing test**

Add to `src/core/color/scales.test.ts`:

```ts
/** WCAG relative luminance, for asserting the ramp's lightness profile. */
function luminance(hex: string): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The light map surface these ramps are drawn on. */
const MAP_BG = '#eef1f6';

describe('SPECTRAL_STOPS on a light canvas', () => {
  it('gets strictly darker as values rise', () => {
    // Magnitude must read by lightness, not hue alone. The old dark-theme ramp
    // was light in the middle, and on a light canvas its mid-range vanished.
    const lums = SPECTRAL_STOPS.map(luminance);
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]!, `step ${i}`).toBeLessThan(lums[i - 1]!);
    }
  });

  it('separates every adjacent step by lightness alone', () => {
    for (let i = 1; i < SPECTRAL_STOPS.length; i += 1) {
      expect(contrast(SPECTRAL_STOPS[i - 1]!, SPECTRAL_STOPS[i]!), `pair ${i}`)
        .toBeGreaterThan(1.2);
    }
  });

  it('makes the high end unmistakable against the surface', () => {
    const top = SPECTRAL_STOPS[SPECTRAL_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(6);
  });

  it('lets the lowest step recede toward the surface, as near-zero should', () => {
    expect(contrast(SPECTRAL_STOPS[0]!, MAP_BG)).toBeLessThan(1.5);
  });

  it('is all six-digit hex', () => {
    for (const stop of SPECTRAL_STOPS) expect(stop).toMatch(/^#[0-9a-f]{6}$/u);
  });
});

describe('BLUE_RED_STOPS on a light canvas', () => {
  it('keeps its high end visible', () => {
    const top = BLUE_RED_STOPS[BLUE_RED_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(5);
  });

  it('has no step that disappears into the surface at the top half', () => {
    // The neutral middle may recede; the upper arm must not.
    for (const stop of BLUE_RED_STOPS.slice(4)) {
      expect(contrast(stop, MAP_BG), stop).toBeGreaterThan(1.6);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/color/scales.test.ts`
Expected: FAIL — the current ramp's luminance is not monotonic (it rises from
`#2b4bd8` to `#e8d13a`).

- [ ] **Step 3: Replace the stops**

In `src/core/color/scales.ts`:

```ts
/**
 * The default map ramp, for a light canvas.
 *
 * Each stop is solved to a target luminance rather than picked by eye, so the
 * ramp darkens monotonically from 0.782 to 0.061 while keeping the spectral
 * hue journey. That matters more here than on a dark canvas: with a pale
 * background, magnitude has to read by lightness as well as hue, and the
 * previous ramp — dark blue, light yellow, dark red — had its lightest stops
 * in the middle, so mid-range values washed out at 1.36 contrast.
 *
 * The lowest stop deliberately sits close to the surface. On a choropleth,
 * "near zero" is supposed to recede.
 */
export const SPECTRAL_STOPS: readonly string[] = [
  '#dbe6f4', // solmuş mavi — en düşük
  '#acd0ea',
  '#5ac0cf',
  '#39ab72',
  '#9c7a16',
  '#a14e12',
  '#871d13', // koyu kırmızı — en yüksek
];

/**
 * Colourblind-friendlier alternative: no green, relies on the blue↔red axis.
 * Re-stepped for the light canvas — the original's pale middle and light arms
 * were built against a dark background.
 */
export const BLUE_RED_STOPS: readonly string[] = [
  '#c6dbef',
  '#83aed4',
  '#4a80b4',
  '#dcdcdc',
  '#d98f77',
  '#bf5b40',
  '#93231a',
];
```

- [ ] **Step 4: Run the test and check coverage**

```bash
npx vitest run src/core/color
npx vitest run --coverage
```

Expected: PASS, and `scales.ts` still at 100% — only data changed.

If the `blueRed` assertions fail, adjust that ramp's arms darker and re-run;
the numbers in the test are the contract, not the hexes.

- [ ] **Step 5: Commit**

```bash
git add src/core/color
git commit -m "feat(color): re-derive the map ramps for a light canvas"
```

---

## Task 3: Swap the chart palette to its light-surface column

**Files:**
- Modify: `src/core/chart/palette.ts`
- Modify: `src/core/chart/palette.test.ts`

**Interfaces:**
- Produces: `CATEGORY_PALETTE` with light-surface values. `categoryColor(index)`
  is unchanged.

- [ ] **Step 1: Extend the palette test**

Add to `src/core/chart/palette.test.ts`:

```ts
function luminance(hex: string): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16))
    + 0.7152 * channel(parseInt(hex.slice(3, 5), 16))
    + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}

describe('CATEGORY_PALETTE on a light panel', () => {
  it('is stepped for a light surface, not a dark one', () => {
    // The dark column sits far lighter than these; if this passes with the
    // dark hexes, the swap did not happen.
    expect(CATEGORY_PALETTE).toContain('#2a78d6');
    expect(CATEGORY_PALETTE).not.toContain('#3987e5');
  });

  it('keeps every hue mid-toned, so none reads as ink or as background', () => {
    for (const hex of CATEGORY_PALETTE) {
      expect(luminance(hex), hex).toBeGreaterThan(0.05);
      expect(luminance(hex), hex).toBeLessThan(0.6);
    }
  });
});
```

- [ ] **Step 2: Replace the palette**

In `src/core/chart/palette.ts`, swap the values and rewrite the doc comment to
record the new validation. The order is unchanged — it is the safety mechanism:

```ts
/**
 * Categorical hues for the charts, in fixed order.
 *
 * Stepped for a **light** surface and validated as a set against the panel
 * background (`#f7f8fa`): every slot sits in the L 0.43–0.77 band, clears the
 * chroma floor, and the worst adjacent pair measures ΔE 9.1 under simulated
 * colour-vision deficiency and 19.6 under normal vision.
 *
 * Three slots — aqua (2.65), yellow (2.04) and magenta (2.53) — fall below 3:1
 * against the surface. That is legal here and only here: the pie's legend
 * prints a label and a number beside every swatch, so no slice depends on
 * colour alone. Strip those labels and this becomes a real defect.
 *
 * **The order is the safety mechanism, not decoration.** Adjacent slots are the
 * pairs a reader compares — neighbouring arcs, neighbouring chips — and the
 * ordering is what keeps those pairs separable. Re-ordering or substituting a
 * hue invalidates the result; re-run the validator if you must.
 *
 * There is deliberately no ninth hue. A generated one is indistinguishable from
 * an existing slot under CVD; the ninth category folds into "Diğer" instead.
 */
export const CATEGORY_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const satisfies readonly `#${string}`[];
```

- [ ] **Step 3: Run and commit**

```bash
npx vitest run src/core/chart src/components/CategoryPieChart
npx vitest run --coverage
```

Expected: PASS. `CategoryPieChart.test.tsx` asserts specific palette entries by
index, not by hex, so it needs no change.

```bash
git add src/core/chart
git commit -m "feat(chart): swap the categorical palette to its light-surface column"
```

---

## Task 4: Fix the panel positions at every window size

The two breakpoints added in Phase 3 rearranged panels below 1024px and hid
them below 640px. The owner wants the arrangement to stay put.

**Files:**
- Modify: `src/styles/base.css`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`

**Interfaces:**
- Produces: no `hm-hide-compact` class and no media queries in `base.css`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`:

```tsx
describe('CrimeHeatMap — fixed layout', () => {
  it('marks no panel as hidden on narrow screens', () => {
    const { container } = renderMap();
    // The Phase 3 breakpoints hid panels below 640px. Positions are fixed now,
    // so nothing carries a hide-on-compact marker.
    expect(container.querySelectorAll('.hm-hide-compact')).toHaveLength(0);
  });

  it('places every panel in its own grid area', () => {
    const { container } = renderMap();
    for (const area of [
      'hm-area-topLeft', 'hm-area-topCentre', 'hm-area-topRight',
      'hm-area-left', 'hm-area-right', 'hm-area-bottomLeft',
    ]) {
      expect(container.querySelector(`.${area}`), area).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Strip the breakpoints**

Delete both media-query blocks from `src/styles/base.css` — the
`@media (max-width: 1023px)` and `@media (max-width: 639px)` rules — and the
`.hm-hide-compact` rule with them. Leave a note where they were:

```css
/*
 * No breakpoints. Panel positions are fixed at every window size by choice:
 * a layout that rearranges itself is harder to learn than one that simply
 * gets tighter. On a narrow window the panels cover more of the map, which is
 * the accepted trade.
 */
```

The `prefers-reduced-motion` block in `tokens.css` is untouched — it is an
accessibility preference, not a size breakpoint.

- [ ] **Step 3: Drop the class from the markup**

In `src/components/CrimeHeatMap/CrimeHeatMap.tsx`, remove ` hm-hide-compact`
from all four `className` strings, leaving just the area class:

```tsx
        <div className="hm-area-topCentre">
        <div className="hm-area-topRight">
        <div className="hm-area-left">
        <div className="hm-area-right">
```

- [ ] **Step 4: Run and commit**

```bash
npx vitest run src/components/CrimeHeatMap
npm run typecheck && npm run lint
```

Expected: PASS, including the existing panel matrix.

```bash
git add src/styles/base.css src/components/CrimeHeatMap
git commit -m "feat(layout): fix panel positions at every window size"
```

---

## Task 5: Collapse the filter bar behind a button

**Files:**
- Modify: `src/components/FilterBar/FilterBar.tsx`
- Modify: `src/components/FilterBar/FilterBar.module.css`
- Modify: `src/components/FilterBar/FilterBar.test.tsx`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`

**Interfaces:**
- Produces, added to `Strings.filters`: `open: string`, `close: string`.
- `FilterBarProps` is unchanged — the open/closed state is the panel's own.

- [ ] **Step 1: Add the strings**

`src/i18n/types.ts`, inside `filters`:

```ts
    /** Accessible names for the collapse toggle. */
    open: string;
    close: string;
```

`src/i18n/tr.ts`, inside `filters`:

```ts
    open: 'Filtreleri aç',
    close: 'Filtreleri kapat',
```

- [ ] **Step 2: Write the failing test**

Add to `src/components/FilterBar/FilterBar.test.tsx`:

```tsx
describe('FilterBar — collapsed by default', () => {
  it('shows only a button until it is opened', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }))
      .toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hırsızlık/u })).not.toBeInTheDocument();
  });

  it('reports its state through aria-expanded', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it('reveals the controls when opened', () => {
    renderBarClosed();
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));

    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Hırsızlık/u })).toBeInTheDocument();
  });

  it('closes again on a second press', () => {
    renderBarClosed();
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.close }));
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  /**
   * A closed filter bar must not hide the fact that filters are active — that
   * is how someone ends up reading a filtered map as the whole picture.
   */
  it('shows an active-filter count on the button while closed', () => {
    const filtered: HeatMapState = {
      ...base,
      filters: { yearRange: [2018, 2019], categories: ['darp'] },
    };
    renderBarClosed(filtered);
    expect(screen.getByRole('button', { name: trStrings.filters.open }).textContent)
      .toMatch(/2/u);
  });

  it('shows no count when nothing is filtered', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }).textContent)
      .not.toMatch(/\d/u);
  });
});
```

The existing `FilterBar` tests all assume the controls are visible, and they
now live behind the toggle. Rename the current helper to `renderBarClosed` and
add an opening wrapper, rather than editing twenty call sites or inventing a
test-only prop the component does not have:

```tsx
/** Renders the bar in its default collapsed state. */
function renderBarClosed(state: HeatMapState = base, props: Partial<FilterBarProps> = {}) {
  // ...the existing body of renderBar, unchanged...
}

/** Renders it and opens it, which is what every pre-existing test assumes. */
function renderBar(state: HeatMapState = base, props: Partial<FilterBarProps> = {}) {
  const utils = renderBarClosed(state, props);
  fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));
  return utils;
}
```

Every existing test keeps calling `renderBar` and needs no change. The new
"collapsed by default" block calls `renderBarClosed`.

- [ ] **Step 3: Implement the collapse**

In `src/components/FilterBar/FilterBar.tsx`, wrap the body:

```tsx
  const [open, setOpen] = useState(false);

  // Count what is actually narrowing the data, so a closed bar still says so.
  const [lo, hi] = filters.yearRange;
  const [boundLo, boundHi] = yearBounds;
  const activeCount = filters.categories.length
    + (lo !== boundLo || hi !== boundHi ? 1 : 0);

  if (!open) {
    return (
      <GlassPanel className={styles.collapsed}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={false}
          aria-label={strings.filters.open}
          onClick={() => { setOpen(true); }}
        >
          <span>{strings.filters.title}</span>
          {activeCount > 0 ? (
            <span className={styles.badge}>{formatTrNumber(activeCount)}</span>
          ) : null}
        </button>
      </GlassPanel>
    );
  }
```

and add a close button to the open header, beside `Sıfırla`:

```tsx
        <button
          type="button"
          className={styles.reset}
          aria-expanded
          aria-label={strings.filters.close}
          onClick={() => { setOpen(false); }}
        >
          ×
        </button>
```

Add to `src/components/FilterBar/FilterBar.module.css`:

```css
.collapsed { padding: 0; width: auto; }

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 0;
  border-radius: var(--hm-radius);
  background: transparent;
  color: var(--hm-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.toggle:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 2px; }

.badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--hm-fg);
  color: var(--hm-ink-inverse);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Run and commit**

```bash
npx vitest run src/components/FilterBar src/i18n
npm run typecheck && npm run lint
```

Expected: PASS — the six new tests plus every existing FilterBar test, which
now open the panel through the shared helper.

```bash
git add src/components/FilterBar src/i18n
git commit -m "feat(filters): collapse the filter bar behind a button"
```

---

**Part 1 ends here.** Tasks 6–9 (the detail panel, province click-through, and
exit verification) are in
`docs/superpowers/plans/2026-08-01-phase-4-detail-and-light-part-2.md`.
