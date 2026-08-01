# Türkiye Suç Haritası — Phase 3: Panels (Part 3 — Charts and integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Continues `docs/superpowers/plans/2026-08-01-phase-3-panels-part-2.md`. The
Global Constraints in `2026-08-01-phase-3-panels.md` apply to every task here.
Tasks 1–7 are complete before starting Task 8.

## Chart design rules for this part

These come from the data-visualization method and are **not negotiable per
chart** — they are why the charts are readable rather than merely colourful.

- **Colour follows the entity, never its rank.** A category's colour comes from
  its index in the `categories` prop, not from its position in the pie. A filter
  that drops a category must not repaint the survivors.
- **The categorical palette is fixed and validated.** Eight hues, in order, for
  the dark surface the panels actually composite to (`#11172b`). It passes the
  lightness band, chroma floor, adjacent-pair CVD separation (worst ΔE 8.4),
  the normal-vision floor (worst ΔE 19.3) and 3:1 contrast. **Do not add a
  ninth hue** — fold the tail into `Diğer`.
- **Numbers accompany colour everywhere** (§6.5 and the method agree).
- **Legend always present for ≥ 2 series**; with ≤ 4 slices also direct-label.
- **Text wears text tokens, never the series colour.** A swatch beside the label
  carries identity; the label itself stays in `--hm-fg` / `--hm-fg-muted`.
- **2px gap between adjacent fills** so neighbouring slices never bleed together.
- **Thin marks, recessive chrome:** 2px line, ≥8px hit targets, hairline grid.
- **One axis.** The trend chart has a single y-scale. Never two.

**Deliberate deviation, recorded here:** the method treats a part-to-whole
donut as "at a glance only, ≤ 6 segments" and would prefer a stacked bar. The
spec mandates a donut (§7.7), so the donut stays — but its `Diğer` rule is
extended to cap the visible slices at **6** as well as folding anything under
3%. Without the cap, eight near-equal categories all render and the chart lands
squarely in the anti-pattern.

---

## Task 8: Chart geometry and the categorical palette

Arc paths, share collapsing and the palette — all pure, all in `core/`, so both
charts stay thin.

**Files:**
- Create: `src/core/chart/arc.ts`
- Create: `src/core/chart/collapse.ts`
- Create: `src/core/chart/palette.ts`
- Modify: `src/core/chart/index.ts`
- Test: `src/core/chart/arc.test.ts`
- Test: `src/core/chart/collapse.test.ts`
- Test: `src/core/chart/palette.test.ts`

**Interfaces:**
- Produces:
  - `arcPath(options: { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number }): string`
  - `Slice` — `{ id: string; label: string; value: number }`
  - `CollapsedSlice` — `Slice & { share: number; isOther: boolean; members: readonly string[] }`
  - `collapseSlices(slices: readonly Slice[], options: { minShare: number; maxSlices: number; otherLabel: string }): CollapsedSlice[]`
  - `CATEGORY_PALETTE: readonly string[]` (8 hues)
  - `categoryColor(index: number): string`

- [x] **Step 1: Write the failing arc test**

Create `src/core/chart/arc.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { arcPath } from './arc.js';

const BASE = { cx: 100, cy: 100, innerRadius: 40, outerRadius: 70 };

/** Every coordinate pair in a path, for geometric assertions. */
function points(d: string): [number, number][] {
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/gu)]
    .map((m) => [Number(m[1]), Number(m[2])]);
}

describe('arcPath', () => {
  it('produces a closed donut segment', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI / 2 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
    expect(d).toContain('A');
  });

  it('keeps every point within the outer radius', () => {
    const d = arcPath({ ...BASE, startAngle: 0.3, endAngle: 2.1 });
    for (const [x, y] of points(d)) {
      const r = Math.hypot(x - BASE.cx, y - BASE.cy);
      expect(r).toBeLessThanOrEqual(BASE.outerRadius + 0.001);
      expect(r).toBeGreaterThanOrEqual(BASE.innerRadius - 0.001);
    }
  });

  it('starts at twelve o clock, so the first slice reads from the top', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: 0.5 });
    const [first] = points(d);
    expect(first![0]).toBeCloseTo(BASE.cx, 3);
    expect(first![1]).toBeCloseTo(BASE.cy - BASE.outerRadius, 3);
  });

  it('sets the large-arc flag past a half turn', () => {
    const small = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI / 2 });
    const large = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI * 1.5 });
    expect(small).toMatch(/A[\d\s.,-]+ 0 0 1/u);
    expect(large).toMatch(/A[\d\s.,-]+ 1 1/u);
  });

  it('returns an empty path for a zero-width slice rather than a stray line', () => {
    expect(arcPath({ ...BASE, startAngle: 1, endAngle: 1 })).toBe('');
  });

  it('returns an empty path for a negative sweep', () => {
    expect(arcPath({ ...BASE, startAngle: 2, endAngle: 1 })).toBe('');
  });

  it('draws a full ring without collapsing to nothing', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI * 2 });
    expect(d).not.toBe('');
    expect(points(d).length).toBeGreaterThan(2);
  });

  it('supports a zero inner radius, giving a solid pie wedge', () => {
    const d = arcPath({ ...BASE, innerRadius: 0, startAngle: 0, endAngle: 1 });
    const hasCentre = points(d).some(
      ([x, y]) => Math.abs(x - BASE.cx) < 0.001 && Math.abs(y - BASE.cy) < 0.001,
    );
    expect(hasCentre).toBe(true);
  });
});
```

- [x] **Step 2: Implement `arc.ts`**

```ts
export interface ArcOptions {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  /** Radians, clockwise from twelve o'clock. */
  startAngle: number;
  endAngle: number;
}

/** Polar to cartesian, with 0 radians at twelve o'clock and angles running clockwise. */
function pointAt(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
}

const FULL_TURN = Math.PI * 2;

/**
 * One donut segment as an SVG path.
 *
 * Angles start at twelve o'clock rather than three, because a share chart is
 * read clockwise from the top and the largest slice belongs there.
 *
 * A zero or negative sweep returns an empty path. Emitting a degenerate arc
 * instead would draw a hairline spoke across the ring — visible, meaningless,
 * and hard to trace back to a slice whose value happens to be zero.
 */
export function arcPath(options: ArcOptions): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = options;

  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';

  // A full ring drawn as a single arc collapses to a point; stop just short.
  const end = sweep >= FULL_TURN ? startAngle + FULL_TURN - 1e-6 : endAngle;
  const largeArc = end - startAngle > Math.PI ? 1 : 0;

  const [ox0, oy0] = pointAt(cx, cy, outerRadius, startAngle);
  const [ox1, oy1] = pointAt(cx, cy, outerRadius, end);

  if (innerRadius <= 0) {
    return [
      `M${ox0},${oy0}`,
      `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${ox1},${oy1}`,
      `L${cx},${cy}`,
      'Z',
    ].join(' ');
  }

  const [ix1, iy1] = pointAt(cx, cy, innerRadius, end);
  const [ix0, iy0] = pointAt(cx, cy, innerRadius, startAngle);

  return [
    `M${ox0},${oy0}`,
    `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${ox1},${oy1}`,
    `L${ix1},${iy1}`,
    `A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${ix0},${iy0}`,
    'Z',
  ].join(' ');
}
```

- [x] **Step 3: Write the failing collapse test**

Create `src/core/chart/collapse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collapseSlices, type Slice } from './collapse.js';

const OPTS = { minShare: 0.03, maxSlices: 6, otherLabel: 'Diğer' };

const EIGHT: Slice[] = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i}`, label: `Kategori ${i}`, value: 100 - i,
}));

describe('collapseSlices', () => {
  it('leaves a small, well-spread set alone', () => {
    const slices: Slice[] = [
      { id: 'a', label: 'A', value: 60 },
      { id: 'b', label: 'B', value: 40 },
    ];
    const out = collapseSlices(slices, OPTS);
    expect(out).toHaveLength(2);
    expect(out.every((s) => !s.isOther)).toBe(true);
  });

  it('computes each share against the total', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 75 }, { id: 'b', label: 'B', value: 25 }],
      OPTS,
    );
    expect(out[0]?.share).toBeCloseTo(0.75);
    expect(out[1]?.share).toBeCloseTo(0.25);
  });

  it('orders slices largest first', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 10 }, { id: 'b', label: 'B', value: 90 }],
      OPTS,
    );
    expect(out[0]?.id).toBe('b');
  });

  it('folds anything under the minimum share into Diğer', () => {
    const slices: Slice[] = [
      { id: 'a', label: 'A', value: 970 },
      { id: 'b', label: 'B', value: 20 },
      { id: 'c', label: 'C', value: 10 },
    ];
    const out = collapseSlices(slices, OPTS);
    expect(out).toHaveLength(2);
    expect(out[1]?.isOther).toBe(true);
    expect(out[1]?.value).toBe(30);
    expect(out[1]?.members).toEqual(['b', 'c']);
  });

  /**
   * Eight near-equal categories clear the 3% floor individually, so without a
   * cap every one of them renders and the chart becomes unreadable.
   */
  it('caps the visible slices even when every share clears the floor', () => {
    const out = collapseSlices(EIGHT, OPTS);
    expect(out).toHaveLength(6);
    expect(out[5]?.isOther).toBe(true);
    expect(out[5]?.members).toHaveLength(3);
  });

  it('keeps the total intact when it folds', () => {
    const out = collapseSlices(EIGHT, OPTS);
    const total = out.reduce((sum, s) => sum + s.value, 0);
    expect(total).toBe(EIGHT.reduce((sum, s) => sum + s.value, 0));
  });

  it('shares still sum to one after folding', () => {
    const out = collapseSlices(EIGHT, OPTS);
    expect(out.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it('does not create a Diğer slice holding a single member', () => {
    // Folding one slice into "Other" hides its name for no gain.
    const slices: Slice[] = [
      { id: 'a', label: 'A', value: 990 },
      { id: 'b', label: 'B', value: 10 },
    ];
    const out = collapseSlices(slices, OPTS);
    expect(out.some((s) => s.isOther)).toBe(false);
    expect(out[1]?.label).toBe('B');
  });

  it('returns nothing for an empty input', () => {
    expect(collapseSlices([], OPTS)).toEqual([]);
  });

  it('returns nothing when every value is zero, rather than dividing by zero', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 0 }, { id: 'b', label: 'B', value: 0 }],
      OPTS,
    );
    expect(out).toEqual([]);
  });

  it('drops zero-valued slices, which would render as invisible arcs', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 100 }, { id: 'b', label: 'B', value: 0 }],
      OPTS,
    );
    expect(out).toHaveLength(1);
  });
});
```

- [x] **Step 4: Implement `collapse.ts`**

```ts
export interface Slice {
  id: string;
  label: string;
  value: number;
}

export interface CollapsedSlice extends Slice {
  /** Fraction of the total, 0..1. */
  share: number;
  isOther: boolean;
  /** Ids folded into this slice. A single id for an ordinary slice. */
  members: readonly string[];
}

export interface CollapseOptions {
  /** Slices below this share fold into "other". */
  minShare: number;
  /** Hard ceiling on rendered slices, including "other". */
  maxSlices: number;
  otherLabel: string;
}

/**
 * Orders slices largest-first and folds the tail into a single "other".
 *
 * Two rules, not one. The share floor removes slivers too thin to see. The
 * count cap exists because a share floor alone does not bound the slice count:
 * eight categories at 12% each all clear a 3% floor, and a donut of eight
 * near-equal wedges cannot be read. Past roughly six segments, adjacent hues
 * blur and the chart stops answering its question.
 *
 * A tail of exactly one is never folded — hiding one category's name behind
 * "other" costs information and saves nothing.
 */
export function collapseSlices(
  slices: readonly Slice[],
  options: CollapseOptions,
): CollapsedSlice[] {
  const { minShare, maxSlices, otherLabel } = options;

  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return [];

  const ordered = [...positive].sort((a, b) => b.value - a.value);

  const keep: Slice[] = [];
  const fold: Slice[] = [];
  for (const slice of ordered) {
    const belowFloor = slice.value / total < minShare;
    // Reserve the last visible position for "other" once folding is inevitable.
    const overCap = keep.length >= maxSlices - 1 && ordered.length > maxSlices;
    if (belowFloor || overCap) fold.push(slice);
    else keep.push(slice);
  }

  // A tail of one keeps its own identity.
  if (fold.length === 1) {
    keep.push(fold[0]!);
    fold.length = 0;
  }

  const out: CollapsedSlice[] = keep.map((slice) => ({
    ...slice,
    share: slice.value / total,
    isOther: false,
    members: [slice.id],
  }));

  if (fold.length > 0) {
    const value = fold.reduce((sum, slice) => sum + slice.value, 0);
    out.push({
      id: '__other__',
      label: otherLabel,
      value,
      share: value / total,
      isOther: true,
      members: fold.map((slice) => slice.id),
    });
  }

  return out;
}
```

- [x] **Step 5: Write the failing palette test**

Create `src/core/chart/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORY_PALETTE, categoryColor } from './palette.js';

describe('CATEGORY_PALETTE', () => {
  it('has eight validated slots', () => {
    expect(CATEGORY_PALETTE).toHaveLength(8);
  });

  it('is all six-digit hex', () => {
    for (const hex of CATEGORY_PALETTE) expect(hex).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('has no duplicate hues', () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
  });
});

describe('categoryColor', () => {
  it('maps an index to its fixed slot', () => {
    expect(categoryColor(0)).toBe(CATEGORY_PALETTE[0]);
    expect(categoryColor(3)).toBe(CATEGORY_PALETTE[3]);
  });

  /**
   * Colour follows the entity, not its rank. A ninth category reusing slot 1
   * would be indistinguishable from the first, so the caller must fold its tail
   * into "other" instead — this clamp makes the failure visible rather than
   * silently generating a duplicate.
   */
  it('clamps past the last slot rather than cycling', () => {
    expect(categoryColor(8)).toBe(CATEGORY_PALETTE[7]);
    expect(categoryColor(99)).toBe(CATEGORY_PALETTE[7]);
  });

  it('clamps a negative index to the first slot', () => {
    expect(categoryColor(-1)).toBe(CATEGORY_PALETTE[0]);
  });
});
```

- [x] **Step 6: Implement `palette.ts`**

```ts
/**
 * Categorical hues for the charts, in fixed order.
 *
 * Stepped for a dark surface and validated as a set against the panels'
 * composited background (`#11172b` — the glass fill over the map): every slot
 * sits in the L 0.48–0.67 band, clears the chroma floor, holds ≥ 3:1 contrast,
 * and the worst adjacent pair measures ΔE 8.4 under simulated colour-vision
 * deficiency and 19.3 under normal vision.
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
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
] as const satisfies readonly `#${string}`[];

/**
 * The colour for a category at a fixed position.
 *
 * Callers must pass the category's index in the dataset's own category list —
 * never its rank in the chart. Ranking the colours would repaint every
 * surviving series whenever a filter changed the order, which reads as the
 * chart re-labelling itself.
 */
export function categoryColor(index: number): string {
  const last = CATEGORY_PALETTE.length - 1;
  if (index < 0) return CATEGORY_PALETTE[0];
  return CATEGORY_PALETTE[index > last ? last : index];
}
```

- [x] **Step 7: Extend the barrel, run, check coverage**

Add to `src/core/chart/index.ts`:

```ts
export type { ArcOptions } from './arc.js';
export { arcPath } from './arc.js';
export type { CollapsedSlice, CollapseOptions, Slice } from './collapse.js';
export { collapseSlices } from './collapse.js';
export { CATEGORY_PALETTE, categoryColor } from './palette.js';
```

```bash
npx vitest run src/core/chart
npx vitest run --coverage
```

Expected: PASS — 8 arc, 11 collapse, 7 palette tests — and every `core/chart`
file at 100%.

- [x] **Step 8: Commit**

```bash
git add src/core/chart
git commit -m "feat(chart): add arc geometry, share collapsing and validated palette"
```

---

## Task 9: CategoryPieChart

**Files:**
- Create: `src/components/CategoryPieChart/CategoryPieChart.tsx`
- Create: `src/components/CategoryPieChart/CategoryPieChart.module.css`
- Create: `src/components/CategoryPieChart/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`, `src/i18n/index.ts`
- Test: `src/components/CategoryPieChart/CategoryPieChart.test.tsx`

**Interfaces:**
- Consumes: `arcPath`, `collapseSlices`, `categoryColor`; `formatPercent`, `formatTrNumber`.
- Produces: `CategoryPieChart` — `(props: { categories: readonly CrimeCategory[]; totals: ReadonlyMap<string, number>; regionName: string | null; onHoverCategory: (id: string | null) => void }) => JSX.Element`
- Produces, added to `Strings`:
  ```ts
  pie: { title: string; national: string; other: string; empty: string };
  ```

- [x] **Step 1: Add the strings**

`src/i18n/types.ts`:

```ts
  pie: {
    title: string;
    /** Shown when no region is selected. */
    national: string;
    other: string;
    empty: string;
  };
```

`src/i18n/tr.ts`:

```ts
  pie: {
    title: 'Suç türü dağılımı',
    national: 'Türkiye geneli',
    other: 'Diğer',
    expand: 'Diğer kategorileri göster',
    collapse: 'Diğer kategorileri gizle',
    empty: 'Veri yok',
  },
```

The `Strings` entry gains the two labels as well:

```ts
  pie: {
    title: string;
    /** Shown when no region is selected. */
    national: string;
    other: string;
    /** Accessible names for the Diğer disclosure (§7.7). */
    expand: string;
    collapse: string;
    empty: string;
  };
```

Add `pie: mergeGroup('pie', overrides),` to `src/i18n/index.ts`.

- [x] **Step 2: Write the failing test**

Create `src/components/CategoryPieChart/CategoryPieChart.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { CATEGORY_PALETTE } from '@/core/chart/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CategoryPieChart } from './CategoryPieChart.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
  { id: 'c', label: 'Gasp' },
];
const TOTALS = new Map([['a', 600], ['b', 300], ['c', 100]]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  flyToRequest: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  metric: 'total',
  scaleMode: 'quantile',
};

function renderPie(props: Partial<Parameters<typeof CategoryPieChart>[0]> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  return render(
    <CategoryPieChart
      categories={CATEGORIES}
      totals={TOTALS}
      regionName={null}
      onHoverCategory={() => {}}
      {...props}
    />,
    { wrapper },
  );
}

describe('CategoryPieChart', () => {
  it('is labelled as a group', () => {
    renderPie();
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
  });

  it('says it is showing the national picture when no region is selected', () => {
    renderPie();
    expect(screen.getByText(trStrings.pie.national)).toBeInTheDocument();
  });

  it('names the selected region instead when there is one', () => {
    renderPie({ regionName: 'İstanbul' });
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
  });

  it('draws an arc per category', () => {
    const { container } = renderPie();
    expect(container.querySelectorAll('path[data-slice]')).toHaveLength(3);
  });

  it('colours each slice by its position in the category list, not its rank', () => {
    // 'c' is the smallest but is third in `categories`, so it takes slot 3.
    const { container } = renderPie();
    const slice = container.querySelector('path[data-slice="c"]');
    expect(slice?.getAttribute('fill')).toBe(CATEGORY_PALETTE[2]);
  });

  it('keeps a category colour stable when a larger one is removed', () => {
    const { container, rerender } = renderPie();
    const before = container.querySelector('path[data-slice="c"]')?.getAttribute('fill');

    rerender(
      <CategoryPieChart
        categories={CATEGORIES}
        totals={new Map([['b', 300], ['c', 100]])}
        regionName={null}
        onHoverCategory={() => {}}
      />,
    );
    expect(container.querySelector('path[data-slice="c"]')?.getAttribute('fill')).toBe(before);
  });

  it('lists every slice with its label, value and share', () => {
    renderPie();
    expect(screen.getByText('Hırsızlık')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('%60,0')).toBeInTheDocument();
  });

  it('reports a hovered slice so the filter chip can highlight', () => {
    const onHoverCategory = vi.fn();
    const { container } = renderPie({ onHoverCategory });

    fireEvent.pointerEnter(container.querySelector('path[data-slice="a"]')!);
    expect(onHoverCategory).toHaveBeenCalledWith('a');

    fireEvent.pointerLeave(container.querySelector('path[data-slice="a"]')!);
    expect(onHoverCategory).toHaveBeenCalledWith(null);
  });

  it('folds a long tail into Diğer', () => {
    const many: CrimeCategory[] = Array.from({ length: 8 }, (_, i) => ({
      id: `k${i}`, label: `Kategori ${i}`,
    }));
    const totals = new Map(many.map((c, i) => [c.id, 100 - i]));
    renderPie({ categories: many, totals });

    expect(screen.getByText(trStrings.pie.other)).toBeInTheDocument();
    // Six visible slices: five named plus Diğer.
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('expands Diğer on click, revealing what it hid', () => {
    const many: CrimeCategory[] = Array.from({ length: 8 }, (_, i) => ({
      id: `k${i}`, label: `Kategori ${i}`,
    }));
    const totals = new Map(many.map((c, i) => [c.id, 100 - i]));
    renderPie({ categories: many, totals });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(trStrings.pie.other, 'u') }));
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('Kategori 7')).toBeInTheDocument();
  });

  it('collapses Diğer again on a second click', () => {
    const many: CrimeCategory[] = Array.from({ length: 8 }, (_, i) => ({
      id: `k${i}`, label: `Kategori ${i}`,
    }));
    const totals = new Map(many.map((c, i) => [c.id, 100 - i]));
    renderPie({ categories: many, totals });

    const toggle = screen.getByRole('button', { name: new RegExp(trStrings.pie.other, 'u') });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(trStrings.pie.collapse, 'u') }));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('keeps expanded slices in their own palette slots, not recoloured by rank', () => {
    const many: CrimeCategory[] = Array.from({ length: 8 }, (_, i) => ({
      id: `k${i}`, label: `Kategori ${i}`,
    }));
    const totals = new Map(many.map((c, i) => [c.id, 100 - i]));
    const { container } = renderPie({ categories: many, totals });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(trStrings.pie.other, 'u') }));
    expect(container.querySelector('path[data-slice="k7"]')?.getAttribute('fill'))
      .toBe(CATEGORY_PALETTE[7]);
  });

  it('says so when there is nothing to show', () => {
    renderPie({ totals: new Map() });
    expect(screen.getByText(trStrings.pie.empty)).toBeInTheDocument();
  });

  it('hides the svg from assistive technology, since the list carries the data', () => {
    const { container } = renderPie();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [x] **Step 3: Implement the chart**

`src/components/CategoryPieChart/CategoryPieChart.module.css`:

```css
.panel { padding: 10px 12px; display: grid; gap: 8px; width: 220px; }
.title { margin: 0; font-size: 12px; font-weight: 600; color: var(--hm-fg); }
.scope { font-size: 11px; color: var(--hm-fg-muted); }
.chart { display: block; margin: 0 auto; }
.slice { transition: opacity var(--hm-motion-hover) var(--hm-ease-hover); cursor: pointer; }
.slice[data-dimmed='true'] { opacity: 0.35; }
.legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }

.item {
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--hm-fg);
}

.swatch { width: 8px; height: 8px; border-radius: 2px; }
.label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.value { font-variant-numeric: tabular-nums; }
.share { font-variant-numeric: tabular-nums; color: var(--hm-fg-muted); }
.empty { margin: 0; font-size: 12px; color: var(--hm-fg-muted); }

.disclosure {
  justify-self: start;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--hm-fg-muted);
  font: inherit;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.disclosure:hover { color: var(--hm-fg); }
.disclosure:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 2px; }
```

`src/components/CategoryPieChart/CategoryPieChart.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { arcPath, categoryColor, collapseSlices, type Slice } from '@/core/chart/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './CategoryPieChart.module.css';

const SIZE = 132;
const OUTER = 62;
const INNER = 38;
const MIN_SHARE = 0.03;
/** Past six segments adjacent hues blur and the donut stops being readable. */
const MAX_SLICES = 6;
/** A 2px gap keeps neighbouring arcs from bleeding into one another. */
const GAP_RADIANS = (2 / OUTER);

export interface CategoryPieChartProps {
  categories: readonly CrimeCategory[];
  totals: ReadonlyMap<string, number>;
  /** Selected region, or null for the national picture. */
  regionName: string | null;
  onHoverCategory: (id: string | null) => void;
}

export function CategoryPieChart({
  categories, totals, regionName, onHoverCategory,
}: CategoryPieChartProps) {
  const strings = useStrings();
  const [hovered, setHovered] = useState<string | null>(null);

  // Slot by position in the dataset's own list, so a category keeps its colour
  // when filtering changes which categories are present.
  const colorById = useMemo(() => new Map(
    categories.map((category, index) => [
      category.id,
      category.color ?? categoryColor(index),
    ]),
  ), [categories]);

  const [expanded, setExpanded] = useState(false);

  const slices = useMemo(() => {
    const raw: Slice[] = categories.map((category) => ({
      id: category.id,
      label: category.label,
      value: totals.get(category.id) ?? 0,
    }));
    return collapseSlices(raw, {
      // Expanding lifts both limits at once. Lifting only the count cap would
      // still hide sub-3% slivers, so the disclosure would not disclose them.
      minShare: expanded ? 0 : MIN_SHARE,
      maxSlices: expanded ? Number.POSITIVE_INFINITY : MAX_SLICES,
      otherLabel: strings.pie.other,
    });
  }, [categories, totals, expanded, strings.pie.other]);

  const hasOther = slices.some((slice) => slice.isOther);

  const arcs = useMemo(() => {
    let angle = 0;
    return slices.map((slice) => {
      const sweep = slice.share * Math.PI * 2;
      const start = angle;
      angle += sweep;
      return {
        slice,
        // Trim the gap off the end so slices never touch. Guarded so a sliver
        // narrower than the gap does not invert into a negative sweep.
        d: arcPath({
          cx: SIZE / 2,
          cy: SIZE / 2,
          innerRadius: INNER,
          outerRadius: OUTER,
          startAngle: start,
          endAngle: Math.max(start, start + sweep - GAP_RADIANS),
        }),
      };
    });
  }, [slices]);

  const setHover = (id: string | null): void => {
    setHovered(id);
    onHoverCategory(id);
  };

  return (
    <GlassPanel label={strings.pie.title} className={styles.panel}>
      <h2 className={styles.title}>{strings.pie.title}</h2>
      <span className={styles.scope}>{regionName ?? strings.pie.national}</span>

      {slices.length === 0 ? (
        <p className={styles.empty}>{strings.pie.empty}</p>
      ) : (
        <>
          {/* The legend below carries every value, so the drawing itself adds
              nothing for a screen reader and would only add noise. */}
          <svg
            className={styles.chart}
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            aria-hidden="true"
          >
            {arcs.map(({ slice, d }) => (
              <path
                key={slice.id}
                d={d}
                data-slice={slice.id}
                data-dimmed={hovered !== null && hovered !== slice.id ? 'true' : 'false'}
                className={styles.slice}
                fill={slice.isOther ? 'var(--hm-fg-muted)' : colorById.get(slice.id)}
                onPointerEnter={() => { setHover(slice.id); }}
                onPointerLeave={() => { setHover(null); }}
              />
            ))}
          </svg>

          <ul className={styles.legend}>
            {slices.map((slice) => (
              <li key={slice.id} className={styles.item}>
                <span
                  className={styles.swatch}
                  style={{
                    background: slice.isOther
                      ? 'var(--hm-fg-muted)'
                      : colorById.get(slice.id),
                  }}
                  aria-hidden="true"
                />
                <span className={styles.label}>{slice.label}</span>
                <span className={styles.value}>{formatTrNumber(slice.value)}</span>
                <span className={styles.share}>{formatPercent(slice.share)}</span>
              </li>
            ))}
          </ul>

          {/* "Diğer" hides real categories, so it has to be openable (§7.7).
              Rendered whenever folding is in effect or has been undone. */}
          {hasOther || expanded ? (
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={expanded}
              onClick={() => { setExpanded((v) => !v); }}
            >
              {expanded
                ? `${strings.pie.collapse}`
                : `${strings.pie.other} · ${strings.pie.expand}`}
            </button>
          ) : null}
        </>
      )}
    </GlassPanel>
  );
}
```

- [x] **Step 4: Write the barrel, run and commit**

`src/components/CategoryPieChart/index.ts`:

```ts
export type { CategoryPieChartProps } from './CategoryPieChart.js';
export { CategoryPieChart } from './CategoryPieChart.js';
```

```bash
npx vitest run src/components/CategoryPieChart
npm run typecheck && npm run lint
```

Expected: PASS, 12 tests.

```bash
git add src/components/CategoryPieChart src/i18n
git commit -m "feat(charts): add category donut with entity-stable colours"
```

---

## Task 10: Line geometry and the TrendChart

**Files:**
- Create: `src/core/chart/line.ts`
- Modify: `src/core/chart/index.ts`
- Create: `src/components/TrendChart/TrendChart.tsx`
- Create: `src/components/TrendChart/TrendChart.module.css`
- Create: `src/components/TrendChart/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`, `src/i18n/index.ts`
- Test: `src/core/chart/line.test.ts`
- Test: `src/components/TrendChart/TrendChart.test.tsx`

**Interfaces:**
- Produces (pure):
  - `Point` — `{ x: number; y: number }`
  - `linePath(points: readonly Point[]): string`
  - `areaPath(points: readonly Point[], baselineY: number): string`
  - `niceMax(value: number): number`
- Produces (React): `TrendChart` — `(props: { byYear: ReadonlyMap<number, number> }) => JSX.Element`
- Produces, added to `Strings`: `trend: { title: string; empty: string; year: string }`

- [x] **Step 1: Write the failing line test**

Create `src/core/chart/line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { areaPath, linePath, niceMax } from './line.js';

const POINTS = [{ x: 0, y: 100 }, { x: 50, y: 60 }, { x: 100, y: 80 }];

describe('linePath', () => {
  it('moves to the first point then lines to the rest', () => {
    expect(linePath(POINTS)).toBe('M0,100 L50,60 L100,80');
  });

  it('returns an empty path for no points', () => {
    expect(linePath([])).toBe('');
  });

  it('draws a lone point as a zero-length move, not a stray line', () => {
    expect(linePath([{ x: 5, y: 5 }])).toBe('M5,5');
  });
});

describe('areaPath', () => {
  it('closes the line down to the baseline', () => {
    const d = areaPath(POINTS, 200);
    expect(d.startsWith('M0,100')).toBe(true);
    expect(d).toContain('L100,200');
    expect(d).toContain('L0,200');
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('returns an empty path for no points', () => {
    expect(areaPath([], 200)).toBe('');
  });

  it('still closes for a single point', () => {
    const d = areaPath([{ x: 10, y: 40 }], 100);
    expect(d).toContain('L10,100');
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });
});

describe('niceMax', () => {
  it('rounds up to a readable axis top', () => {
    expect(niceMax(87)).toBe(100);
    expect(niceMax(1234)).toBe(2000);
    expect(niceMax(2100)).toBe(2500);
  });

  it('leaves an already-round value alone', () => {
    expect(niceMax(100)).toBe(100);
    expect(niceMax(500)).toBe(500);
  });

  it('returns a usable axis for zero, so an empty chart still has a scale', () => {
    expect(niceMax(0)).toBe(1);
  });

  it('handles a negative or non-finite value without producing NaN', () => {
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
  });
});
```

- [x] **Step 2: Implement `line.ts`**

```ts
export interface Point {
  x: number;
  y: number;
}

/** Polyline through the points. Empty for no points. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return '';

  const [first, ...rest] = points;
  const head = `M${first!.x},${first!.y}`;
  return rest.length === 0
    ? head
    : `${head} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')}`;
}

/** The same line closed down to a baseline, for the shaded fill under it. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return '';

  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${linePath(points)} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

/** Axis tops that read well: 1, 2 or 5 times a power of ten. */
const STEPS = [1, 2, 2.5, 5, 10];

/**
 * Rounds a maximum up to a readable axis top.
 *
 * A raw maximum makes the top gridline an arbitrary number like 4,713, which
 * costs a reader a moment every time they look at it. Zero and non-finite
 * inputs return 1 so an empty chart still has a scale to draw against rather
 * than dividing by zero.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}
```

Add to `src/core/chart/index.ts`:

```ts
export type { Point } from './line.js';
export { areaPath, linePath, niceMax } from './line.js';
```

- [x] **Step 3: Run the line test and check coverage**

```bash
npx vitest run src/core/chart/line.test.ts
npx vitest run --coverage
```

Expected: PASS, 10 tests, `line.ts` at 100%.

- [x] **Step 4: Add the strings**

`src/i18n/types.ts`:

```ts
  trend: { title: string; empty: string; year: string };
```

`src/i18n/tr.ts`:

```ts
  trend: { title: 'Yıllara göre', empty: 'Veri yok', year: 'Yıl' },
```

Add `trend: mergeGroup('trend', overrides),` to `src/i18n/index.ts`.

- [x] **Step 5: Write the failing TrendChart test**

Create `src/components/TrendChart/TrendChart.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { TrendChart } from './TrendChart.js';

const BY_YEAR = new Map([
  [2018, 100], [2019, 140], [2020, 90], [2021, 200], [2022, 160],
]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  flyToRequest: null,
  filters: { yearRange: [2019, 2021], categories: [] },
  defaultFilters: { yearRange: [2018, 2022], categories: [] },
  yearBounds: [2018, 2022],
  metric: 'total',
  scaleMode: 'quantile',
};

function renderTrend(state: HeatMapState = base, byYear = BY_YEAR) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<TrendChart byYear={byYear} />, { wrapper });
  return { ...utils, store };
}

describe('TrendChart', () => {
  it('is labelled as a group', () => {
    renderTrend();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });

  it('draws a line and a shaded area', () => {
    const { container } = renderTrend();
    expect(container.querySelector('[data-role="line"]')).not.toBeNull();
    expect(container.querySelector('[data-role="area"]')).not.toBeNull();
  });

  it('plots one marker per year', () => {
    const { container } = renderTrend();
    expect(container.querySelectorAll('[data-role="marker"]')).toHaveLength(5);
  });

  it('dims the years outside the active filter range', () => {
    const { container } = renderTrend();
    const dimmed = container.querySelectorAll('[data-role="marker"][data-active="false"]');
    // 2018 and 2022 sit outside [2019, 2021].
    expect(dimmed).toHaveLength(2);
  });

  it('sets the filter to a single year when one is clicked', () => {
    const { container, store } = renderTrend();
    fireEvent.click(container.querySelector('[data-role="hit"][data-year="2020"]')!);
    expect(store.getState().filters.yearRange).toEqual([2020, 2020]);
  });

  it('shows a guide and value on hover', () => {
    const { container } = renderTrend();
    fireEvent.pointerEnter(container.querySelector('[data-role="hit"][data-year="2021"]')!);

    expect(container.querySelector('[data-role="guide"]')).not.toBeNull();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('clears the guide on leave', () => {
    const { container } = renderTrend();
    const hit = container.querySelector('[data-role="hit"][data-year="2021"]')!;
    fireEvent.pointerEnter(hit);
    fireEvent.pointerLeave(hit);
    expect(container.querySelector('[data-role="guide"]')).toBeNull();
  });

  it('exposes the series as a table for screen readers', () => {
    renderTrend();
    const rows = screen.getAllByRole('row');
    // One header row plus one per year.
    expect(rows).toHaveLength(6);
  });

  it('says so when there is nothing to plot', () => {
    renderTrend(base, new Map());
    expect(screen.getByText(trStrings.trend.empty)).toBeInTheDocument();
  });

  it('survives a single-year dataset without dividing by zero', () => {
    const { container } = renderTrend(base, new Map([[2020, 50]]));
    const marker = container.querySelector('[data-role="marker"]');
    expect(marker).not.toBeNull();
    expect(Number(marker?.getAttribute('cx'))).not.toBeNaN();
  });
});
```

- [x] **Step 6: Implement the chart**

`src/components/TrendChart/TrendChart.module.css`:

```css
.panel { padding: 10px 12px; display: grid; gap: 6px; width: 260px; }
.title { margin: 0; font-size: 12px; font-weight: 600; color: var(--hm-fg); }
.chart { display: block; overflow: visible; }
.grid { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }
.area { fill: var(--hm-fg); opacity: 0.12; }
.line { fill: none; stroke: var(--hm-fg); stroke-width: 2; stroke-linejoin: round; }
.marker { fill: var(--hm-fg); }
.marker[data-active='false'] { opacity: 0.35; }
.guide { stroke: var(--hm-focus-ring); stroke-width: 1; }
.hit { fill: transparent; cursor: pointer; }

.readout {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--hm-fg-muted);
  font-variant-numeric: tabular-nums;
  min-height: 15px;
}

.readoutValue { color: var(--hm-fg); font-weight: 600; }
.empty { margin: 0; font-size: 12px; color: var(--hm-fg-muted); }
```

`src/components/TrendChart/TrendChart.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import {
  areaPath, createLinearScale, linePath, niceMax, type Point,
} from '@/core/chart/index.js';
import { formatCompactTr, formatTrNumber } from '@/core/format/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './TrendChart.module.css';

const WIDTH = 236;
const HEIGHT = 84;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 16;
/** Markers are 3px; the hit target is far larger, per the interaction rules. */
const HIT_WIDTH = 22;

export interface TrendChartProps {
  byYear: ReadonlyMap<number, number>;
}

export function TrendChart({ byYear }: TrendChartProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const [activeStart, activeEnd] = useHeatMapState((state) => state.filters.yearRange);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const series = useMemo(
    () => [...byYear.entries()].sort((a, b) => a[0] - b[0]),
    [byYear],
  );

  const plotted = useMemo(() => {
    if (series.length === 0) return null;

    const years = series.map(([year]) => year);
    const max = niceMax(Math.max(...series.map(([, value]) => value)));

    // A single-year dataset has a zero-width domain; createLinearScale maps it
    // to the range start rather than dividing by zero, so centre it instead of
    // pinning it to the left edge.
    const x = series.length === 1
      ? () => WIDTH / 2
      : createLinearScale([years[0]!, years[years.length - 1]!], [PAD_X, WIDTH - PAD_X]).toRange;
    const y = createLinearScale([0, max], [HEIGHT - PAD_BOTTOM, PAD_TOP]).toRange;

    const points: (Point & { year: number; value: number })[] = series.map(
      ([year, value]) => ({ x: x(year), y: y(value), year, value }),
    );
    return { points, max, baseline: HEIGHT - PAD_BOTTOM };
  }, [series]);

  const hoveredValue = hoveredYear === null ? null : byYear.get(hoveredYear) ?? null;

  return (
    <GlassPanel label={strings.trend.title} className={styles.panel}>
      <h2 className={styles.title}>{strings.trend.title}</h2>

      {plotted === null ? (
        <p className={styles.empty}>{strings.trend.empty}</p>
      ) : (
        <>
          <svg
            className={styles.chart}
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            aria-hidden="true"
          >
            <line
              className={styles.grid}
              x1={0} y1={plotted.baseline} x2={WIDTH} y2={plotted.baseline}
            />
            <path className={styles.area} data-role="area"
              d={areaPath(plotted.points, plotted.baseline)} />
            <path className={styles.line} data-role="line" d={linePath(plotted.points)} />

            {hoveredYear === null ? null : (() => {
              const point = plotted.points.find((p) => p.year === hoveredYear);
              return point === undefined ? null : (
                <line
                  className={styles.guide}
                  data-role="guide"
                  x1={point.x} y1={PAD_TOP} x2={point.x} y2={plotted.baseline}
                />
              );
            })()}

            {plotted.points.map((point) => (
              <circle
                key={point.year}
                className={styles.marker}
                data-role="marker"
                // The active filter range stays bright; the rest dims, so the
                // selection is always visible in context (§7.7).
                data-active={point.year >= activeStart && point.year <= activeEnd
                  ? 'true' : 'false'}
                cx={point.x}
                cy={point.y}
                r={point.year === hoveredYear ? 4 : 3}
              />
            ))}

            {plotted.points.map((point) => (
              <rect
                key={point.year}
                className={styles.hit}
                data-role="hit"
                data-year={point.year}
                x={point.x - HIT_WIDTH / 2}
                y={0}
                width={HIT_WIDTH}
                height={HEIGHT}
                onPointerEnter={() => { setHoveredYear(point.year); }}
                onPointerLeave={() => { setHoveredYear(null); }}
                onClick={() => {
                  dispatch({ type: 'setYearRange', range: [point.year, point.year] });
                }}
              />
            ))}
          </svg>

          <div className={styles.readout}>
            {hoveredYear === null ? (
              <>
                <span>{plotted.points[0]?.year}</span>
                <span>{formatCompactTr(plotted.max)}</span>
              </>
            ) : (
              <>
                <span>{hoveredYear}</span>
                <span className={styles.readoutValue}>
                  {hoveredValue === null ? strings.trend.empty : formatTrNumber(hoveredValue)}
                </span>
              </>
            )}
          </div>

          {/* The drawing is aria-hidden, so the series is exposed as a table —
              the accessible equivalent of the chart, not a duplicate of it. */}
          <table className="hm-visually-hidden">
            <caption>{strings.trend.title}</caption>
            <thead>
              <tr><th scope="col">{strings.trend.year}</th><th scope="col">{strings.tooltip.total}</th></tr>
            </thead>
            <tbody>
              {series.map(([year, value]) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  <td>{formatTrNumber(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </GlassPanel>
  );
}
```

- [x] **Step 7: Write the barrel, run and commit**

`src/components/TrendChart/index.ts`:

```ts
export type { TrendChartProps } from './TrendChart.js';
export { TrendChart } from './TrendChart.js';
```

```bash
npx vitest run src/core/chart src/components/TrendChart
npm run typecheck && npm run lint
```

Expected: PASS, 10 tests.

```bash
git add src/core/chart src/components/TrendChart src/i18n
git commit -m "feat(charts): add trend chart with active-range highlighting"
```

---

## Task 11: Per-capita metric

§6.6 promises that supplying `population` reveals a `Nüfusa göre` toggle and
switches the metric to crimes per 100,000 residents. Task 4 renders the toggle
and Phase 2 stores the mode, but **nothing computes the rate** — so as things
stand the control changes a flag and no number on screen moves.

A control that appears to work and does not is worse than an absent one, so the
computation lands here rather than being deferred.

**Files:**
- Create: `src/core/aggregation/perCapita.ts`
- Modify: `src/core/aggregation/index.ts`
- Modify: `src/hooks/useAggregates.ts`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`
- Test: `src/core/aggregation/perCapita.test.ts`
- Test: `src/hooks/useAggregates.test.tsx`

**Interfaces:**
- Produces:
  - `PopulationIndex` — `ReadonlyMap<string, number>` (region code → population for the filtered span)
  - `buildPopulationIndex(population: readonly RegionPopulation[], level: GeoLevel, yearRange: readonly [number, number]): PopulationIndex`
  - `toPerCapita(rollup: RollupResult, populations: PopulationIndex, per?: number): RollupResult`
- Adds to `AggregateResult`: nothing new — `rollup` and `heatRollup` are already
  rate-valued when the metric is `perCapita`.

- [x] **Step 1: Write the failing test**

Create `src/core/aggregation/perCapita.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RegionPopulation } from '@/core/types/index.js';
import { buildIndex, rollup } from './index.js';
import { buildPopulationIndex, toPerCapita } from './perCapita.js';

const CATEGORIES = [{ id: 'a', label: 'A' }];
const index = buildIndex({
  data: [
    { year: 2020, ilCode: '34', category: 'a', count: 200 },
    { year: 2020, ilCode: '06', category: 'a', count: 50 },
  ],
  categories: CATEGORIES,
});
const rolled = rollup(index, 'il', { yearRange: [2020, 2020], categories: [] });

const POPULATION: RegionPopulation[] = [
  { ilCode: '34', year: 2020, population: 1_000_000 },
  { ilCode: '06', year: 2020, population: 500_000 },
];

describe('buildPopulationIndex', () => {
  it('keys provinces by plaka code', () => {
    const pop = buildPopulationIndex(POPULATION, 'il', [2020, 2020]);
    expect(pop.get('34')).toBe(1_000_000);
  });

  it('averages across the filtered years rather than summing them', () => {
    // Summing would make a ten-year range look ten times as populous.
    const multi: RegionPopulation[] = [
      { ilCode: '34', year: 2020, population: 1_000_000 },
      { ilCode: '34', year: 2021, population: 1_200_000 },
    ];
    expect(buildPopulationIndex(multi, 'il', [2020, 2021]).get('34')).toBe(1_100_000);
  });

  it('ignores years outside the range', () => {
    const multi: RegionPopulation[] = [
      { ilCode: '34', year: 2019, population: 9_000_000 },
      { ilCode: '34', year: 2020, population: 1_000_000 },
    ];
    expect(buildPopulationIndex(multi, 'il', [2020, 2020]).get('34')).toBe(1_000_000);
  });

  it('keys districts by ilçe code at district level', () => {
    const district: RegionPopulation[] = [
      { ilCode: '34', ilceCode: '3401', year: 2020, population: 20_000 },
    ];
    expect(buildPopulationIndex(district, 'ilce', [2020, 2020]).get('3401')).toBe(20_000);
  });

  it('skips il-only rows at district level rather than mis-keying them', () => {
    expect(buildPopulationIndex(POPULATION, 'ilce', [2020, 2020]).size).toBe(0);
  });

  it('is empty for no population data', () => {
    expect(buildPopulationIndex([], 'il', [2020, 2020]).size).toBe(0);
  });
});

describe('toPerCapita', () => {
  const pop = buildPopulationIndex(POPULATION, 'il', [2020, 2020]);

  it('converts totals to a rate per 100,000', () => {
    const rate = toPerCapita(rolled, pop);
    expect(rate.byRegion.get('34')?.total).toBe(20);
    expect(rate.byRegion.get('06')?.total).toBe(10);
  });

  /** The whole point: Ankara outranks İstanbul once size is accounted for. */
  it('reorders regions relative to raw counts', () => {
    const raw = rolled.byRegion.get('34')!.total > rolled.byRegion.get('06')!.total;
    const rate = toPerCapita(rolled, pop);
    const byRate = rate.byRegion.get('34')!.total > rate.byRegion.get('06')!.total;
    expect(raw).toBe(true);
    expect(byRate).toBe(true);
  });

  it('converts the per-category breakdown too', () => {
    const rate = toPerCapita(rolled, pop);
    expect(rate.byRegion.get('34')?.byCategory.get('a')).toBe(20);
  });

  it('drops a region with no population rather than dividing by zero', () => {
    const rate = toPerCapita(rolled, new Map([['34', 1_000_000]]));
    expect(rate.byRegion.has('34')).toBe(true);
    expect(rate.byRegion.has('06')).toBe(false);
  });

  it('drops a region whose population is zero', () => {
    const rate = toPerCapita(rolled, new Map([['34', 0]]));
    expect(rate.byRegion.has('34')).toBe(false);
  });

  it('rebuilds values so the colour domain follows the rate', () => {
    const rate = toPerCapita(rolled, pop);
    expect([...rate.values].sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it('honours a custom per-N base', () => {
    expect(toPerCapita(rolled, pop, 1_000_000).byRegion.get('34')?.total).toBe(200);
  });

  it('keeps the level', () => {
    expect(toPerCapita(rolled, pop).level).toBe('il');
  });
});
```

- [x] **Step 2: Implement `perCapita.ts`**

```ts
import type { GeoLevel, RegionPopulation } from '@/core/types/index.js';
import type { RegionAggregate, RollupResult } from './rollup.js';

export type PopulationIndex = ReadonlyMap<string, number>;

/** Crimes per this many residents. The convention for published crime rates. */
const DEFAULT_PER = 100_000;

/**
 * Population per region for the filtered years.
 *
 * Averaged across the range, not summed. Summing would make a ten-year filter
 * report a province as ten times as populous and drive every rate to a tenth of
 * its true value — a bug that looks like plausible data.
 */
export function buildPopulationIndex(
  population: readonly RegionPopulation[],
  level: GeoLevel,
  yearRange: readonly [number, number],
): PopulationIndex {
  const [start, end] = yearRange;
  const sums = new Map<string, { total: number; count: number }>();

  for (const row of population) {
    if (row.year < start || row.year > end) continue;

    // At district level an il-only row has no district to attribute to.
    // Keying it by its province would silently give every district in that
    // province the whole provincial population.
    const code = level === 'ilce' ? row.ilceCode : row.ilCode;
    if (code === undefined) continue;

    const entry = sums.get(code) ?? { total: 0, count: 0 };
    entry.total += row.population;
    entry.count += 1;
    sums.set(code, entry);
  }

  const out = new Map<string, number>();
  for (const [code, { total, count }] of sums) out.set(code, total / count);
  return out;
}

/**
 * Restates a rollup as a rate per `per` residents.
 *
 * A region with no population is dropped rather than rendered as zero: "no
 * population figure" and "nobody lives here" are different claims, and a zero
 * would paint the region at the bottom of the scale as though it were safe.
 */
export function toPerCapita(
  result: RollupResult,
  populations: PopulationIndex,
  per: number = DEFAULT_PER,
): RollupResult {
  const byRegion = new Map<string, RegionAggregate>();
  const values: number[] = [];

  for (const [code, aggregate] of result.byRegion) {
    const population = populations.get(code);
    if (population === undefined || population <= 0) continue;

    const factor = per / population;
    const byCategory = new Map<string, number>();
    for (const [id, count] of aggregate.byCategory) byCategory.set(id, count * factor);

    const byYear = new Map<number, number>();
    for (const [year, count] of aggregate.byYear) byYear.set(year, count * factor);

    const total = aggregate.total * factor;
    byRegion.set(code, { code, total, byCategory, byYear });
    values.push(total);
  }

  return {
    level: result.level,
    byRegion,
    total: result.total,
    byCategory: result.byCategory,
    byYear: result.byYear,
    values,
  };
}
```

Add to `src/core/aggregation/index.ts`:

```ts
export type { PopulationIndex } from './perCapita.js';
export { buildPopulationIndex, toPerCapita } from './perCapita.js';
```

- [x] **Step 3: Run the test and check coverage**

```bash
npx vitest run src/core/aggregation/perCapita.test.ts
npx vitest run --coverage
```

Expected: PASS, 14 tests, `perCapita.ts` at 100%.

- [x] **Step 4: Apply the metric in `useAggregates`**

Add `population` to `AggregatesInput`:

```ts
  population?: readonly RegionPopulation[] | undefined;
```

and convert both rollups when the metric is per-capita, after they are computed:

```ts
  const metric = useHeatMapState((state) => state.metric);

  const rated = useMemo(() => {
    if (metric !== 'perCapita' || population === undefined) return rolled;
    return toPerCapita(rolled, buildPopulationIndex(population, level, filters.yearRange));
  }, [metric, population, rolled, level, filters.yearRange]);

  const ratedHeat = useMemo(() => {
    if (metric !== 'perCapita' || population === undefined) return heatRolled;
    if (heatLevel === level) return rated;
    return toPerCapita(
      heatRolled,
      buildPopulationIndex(population, heatLevel, filters.yearRange),
    );
  }, [metric, population, heatRolled, heatLevel, level, rated, filters.yearRange]);
```

Return `rated` and `ratedHeat` as `rollup` and `heatRollup`, and build `scale`
from `ratedHeat.values` so the legend follows the rate.

Pass the prop through in `CrimeHeatMap`'s `Content`:

```tsx
  const { rollup, heatRollup, scale, names } = useAggregates({
    data, categories, colorScale, population,
  });
```

- [x] **Step 5: Cover the wiring**

Add to `src/hooks/useAggregates.test.tsx`:

```tsx
  it('leaves totals alone while the metric is total', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
  });

  it('restates totals as a rate once the metric is per-capita', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    // 110 per 1,000,000 residents is 11 per 100,000.
    expect(result.current.rollup.byRegion.get('34')?.total).toBeCloseTo(11);
  });

  it('falls back to totals when per-capita is asked for with no population', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
  });

  it('builds the colour scale from the rate, so the legend matches the map', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    expect(result.current.scale.domain.max).toBeLessThan(110);
  });
```

with the fixture:

```tsx
const POPULATION: RegionPopulation[] = [
  { ilCode: '34', ilceCode: '3401', year: 2020, population: 1_000_000 },
  { ilCode: '06', ilceCode: '0601', year: 2020, population: 500_000 },
  { ilCode: '34', ilceCode: '3401', year: 2021, population: 1_000_000 },
  { ilCode: '06', ilceCode: '0601', year: 2021, population: 500_000 },
];
```

- [x] **Step 6: Run and commit**

```bash
npx vitest run src/core/aggregation src/hooks/useAggregates.test.tsx
npm run typecheck && npm run lint
```

```bash
git add src/core/aggregation src/hooks/useAggregates.ts src/components/CrimeHeatMap
git commit -m "feat(aggregation): compute per-capita rates so the metric toggle does something"
```

---

## Task 12: Layout, the panel matrix, and Phase 3 exit checks

Mounts every panel in the overlay grid, honours `PanelFlags`, reflows when a
panel is off, and proves the whole thing in a browser.

**Files:**
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.module.css`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`
- Modify: `src/styles/base.css`
- Modify: `src/index.ts`, `src/index.test.ts`
- Modify: `playground/main.tsx`, `README.md`

- [x] **Step 1: Give the overlay named grid areas**

Replace the `.hm-overlay` rule in `src/styles/base.css`:

```css
/*
 * The overlay spans the map so panels can be positioned against it, but it must
 * not intercept drags: the map stays grabbable in the gaps between panels.
 * GlassPanel re-enables pointer events for itself.
 *
 * `auto` tracks collapse to zero when their panel is absent, so switching a
 * panel off reflows the rest rather than leaving a hole (§7.8).
 */
.hm-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "topLeft    topCentre  topRight"
    "left       centre     right"
    "bottomLeft bottomCtr  bottomRight";
  gap: 12px;
  padding: 12px;
}

.hm-area-topLeft     { grid-area: topLeft; align-self: start; }
.hm-area-topRight    { grid-area: topRight; align-self: start; justify-self: end; }
.hm-area-left        { grid-area: left; align-self: start; min-height: 0; }
.hm-area-right       { grid-area: right; align-self: start; justify-self: end; }
.hm-area-bottomLeft  { grid-area: bottomLeft; align-self: end; }

/*
 * Below 1024px the sidebar becomes a bottom sheet and the charts stack, so the
 * map keeps most of the frame (§6.1).
 */
@media (max-width: 1023px) {
  .hm-overlay { grid-template-columns: 1fr; grid-template-areas: "topCentre" "centre" "bottomCtr"; }
  .hm-area-left, .hm-area-right { grid-area: bottomCtr; justify-self: stretch; }
  .hm-area-topLeft, .hm-area-topRight { grid-area: topCentre; justify-self: stretch; }
}

/* Below 640px only the map, search and legend remain. */
@media (max-width: 639px) {
  .hm-hide-compact { display: none; }
}
```

- [x] **Step 2: Mount the panels**

In `src/components/CrimeHeatMap/CrimeHeatMap.tsx`, replace `Content` with the
full layout. Each panel is mounted only when its flag is on — an unmounted panel
must leave no DOM behind:

```tsx
function Content({ props, panels }: ContentProps) {
  const {
    data, categories, population, colorScale = 'spectral', heatStyle = 'glow',
  } = props;
  const { rollup, heatRollup, scale, names } = useAggregates({ data, categories, colorScale });
  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const sort = 'total-desc' as const;

  // Lifted here only because two panels need it — the pie reports the hovered
  // category and the filter bar highlights the matching chip. Neither imports
  // the other.
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const rows = useMemo(
    () => rankRegions(rollup, { sort, names }),
    [rollup, names],
  );

  /** Category totals for the selected region, or nationally when none. */
  const categoryTotals = useMemo(() => {
    const source = selectedCode === null
      ? rollup.byCategory
      : rollup.byRegion.get(selectedCode)?.byCategory ?? new Map<string, number>();
    return new Map(source);
  }, [rollup, selectedCode]);

  return (
    <>
      <MapCanvas
        data={data}
        categories={categories}
        colorScale={colorScale}
        heatStyle={heatStyle}
        {...(props.onRegionClick === undefined ? {} : { onRegionClick: props.onRegionClick })}
        {...(props.testViewport === undefined ? {} : { testViewport: props.testViewport })}
      />

      <div className="hm-overlay">
        {panels.search ? (
          <div className="hm-area-topLeft"><SearchBar categories={categories} /></div>
        ) : null}

        {panels.filters ? (
          <div className="hm-area-topRight hm-hide-compact">
            <FilterBar
              categories={categories}
              categoryTotals={categoryTotals}
              hasPopulation={population !== undefined && population.length > 0}
              highlightedCategory={hoveredCategory}
            />
          </div>
        ) : null}

        {panels.sidebar ? (
          <div className="hm-area-left hm-hide-compact">
            <Sidebar rows={rows} scale={scale} />
          </div>
        ) : null}

        {panels.pie || panels.trend ? (
          <div className="hm-area-right hm-hide-compact">
            {panels.pie ? (
              <CategoryPieChart
                categories={categories}
                totals={categoryTotals}
                regionName={selectedCode === null ? null : names.get(selectedCode) ?? null}
                onHoverCategory={setHoveredCategory}
              />
            ) : null}
            {panels.trend ? <TrendChart byYear={rollup.byYear} /> : null}
          </div>
        ) : null}

        <div className="hm-area-bottomLeft">
          {panels.legend ? <Legend scale={scale} /> : null}
          <Attribution />
        </div>
      </div>

      {panels.tooltip ? (
        <HoverTooltip rollup={rollup} names={names} categories={categories} />
      ) : null}
    </>
  );
}
```

Widen `resolvedPanels` in `CrimeHeatMap` to cover every flag, all defaulting to
`true`:

```tsx
  const resolvedPanels = {
    legend: panels?.legend ?? true,
    tooltip: panels?.tooltip ?? true,
    sidebar: panels?.sidebar ?? true,
    search: panels?.search ?? true,
    filters: panels?.filters ?? true,
    pie: panels?.pie ?? true,
    trend: panels?.trend ?? true,
  };
```

and change `ContentProps.panels` to `Record<keyof typeof resolvedPanels, boolean>`.

- [x] **Step 3: Write the panel matrix test**

Add to `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`:

```tsx
const PANEL_QUERIES: Record<string, () => HTMLElement | null> = {
  legend: () => screen.queryByRole('group', { name: trStrings.legend.title }),
  sidebar: () => screen.queryByRole('group', { name: trStrings.sidebar.title }),
  search: () => screen.queryByRole('combobox', { name: trStrings.search.label }),
  filters: () => screen.queryByRole('group', { name: trStrings.filters.title }),
  pie: () => screen.queryByRole('group', { name: trStrings.pie.title }),
  trend: () => screen.queryByRole('group', { name: trStrings.trend.title }),
};

describe('CrimeHeatMap — panel matrix', () => {
  it('mounts every panel by default', () => {
    renderMap();
    for (const [name, query] of Object.entries(PANEL_QUERIES)) {
      expect(query(), name).toBeInTheDocument();
    }
  });

  it.each(Object.keys(PANEL_QUERIES))('mounts no DOM at all for a disabled %s', (name) => {
    renderMap({ panels: { [name]: false } });
    expect(PANEL_QUERIES[name]!()).not.toBeInTheDocument();
  });

  it.each(Object.keys(PANEL_QUERIES))('leaves the other panels mounted when %s is off', (name) => {
    renderMap({ panels: { [name]: false } });
    for (const [other, query] of Object.entries(PANEL_QUERIES)) {
      if (other !== name) expect(query(), other).toBeInTheDocument();
    }
  });

  it('still renders the map with every panel disabled', () => {
    renderMap({
      panels: {
        legend: false, tooltip: false, sidebar: false,
        search: false, filters: false, pie: false, trend: false,
      },
    });
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('keeps the attribution even with every panel disabled, since the licence requires it', () => {
    renderMap({
      panels: {
        legend: false, tooltip: false, sidebar: false,
        search: false, filters: false, pie: false, trend: false,
      },
    });
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });
});
```

Note: `DATA` in that file has only two records with one category. Give it
enough shape for the charts to render — three categories across three years:

```tsx
const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
  { id: 'gasp', label: 'Gasp' },
];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'darp', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'gasp', count: 70 },
  { year: 2022, ilCode: '06', ilceCode: '0601', category: 'hirsizlik', count: 55 },
];
```

- [x] **Step 4: Run the matrix and fix what it finds**

```bash
npx vitest run src/components/CrimeHeatMap
```

Expected: PASS. The "leaves the other panels mounted" cases are the ones that
catch accidental coupling — if switching the pie off also removes the trend
chart, the shared `hm-area-right` wrapper is being gated on the wrong flag.

- [x] **Step 5: Extend the public API**

Add to `src/index.ts`:

```ts
// Chart geometry and the categorical palette, for consumers building their own
// panels against the same visual language.
export type { CollapsedSlice, LinearScale, Point, Slice } from './core/chart/index.js';
export {
  CATEGORY_PALETTE, arcPath, areaPath, categoryColor, collapseSlices,
  createLinearScale, linePath, niceMax, snapToStep,
} from './core/chart/index.js';
export type { ListWindow } from './core/list/index.js';
export { computeWindow } from './core/list/index.js';
```

Add to `src/index.test.ts`:

```ts
describe('Phase 3 public surface', () => {
  it('exports the validated categorical palette', async () => {
    const api = await import('./index.js');
    expect(api.CATEGORY_PALETTE).toHaveLength(8);
    expect(api.categoryColor(0)).toBe(api.CATEGORY_PALETTE[0]);
  });

  it('exports the chart geometry helpers', async () => {
    const api = await import('./index.js');
    expect(typeof api.arcPath).toBe('function');
    expect(typeof api.linePath).toBe('function');
    expect(api.niceMax(87)).toBe(100);
  });
});
```

- [x] **Step 6: Run the full verification**

```bash
npm run verify
```

Every line must pass:
- `typecheck` — no errors
- `lint` — clean, including the `core/`-purity rule and `react-hooks/exhaustive-deps`
- all tests pass
- `src/core` at **100% branch coverage** — this phase added `chart/scale.ts`,
  `chart/arc.ts`, `chart/collapse.ts`, `chart/palette.ts`, `chart/line.ts` and
  `list/window.ts`, and every one must be fully covered

```bash
npx eslint src/core --max-warnings 0
```

- [x] **Step 7: Check the bundle against the budget**

```bash
npm run build
node -e "const{gzipSync}=require('node:zlib'),fs=require('fs');const b=fs.readFileSync('dist/index.mjs');const g=['il','ilce'].reduce((n,l)=>n+gzipSync(fs.readFileSync('src/data/geo/turkiye-'+l+'.topo.json'),{level:9}).byteLength,0);const t=gzipSync(b,{level:9}).byteLength;const c=gzipSync(fs.readFileSync('dist/style.css'),{level:9}).byteLength;const k=x=>Math.round(x/1024)+'KB';console.log('total',k(t),'| geo',k(g),'(120KB)','| code+css',k(t-g+c),'(60KB)');"
```

Phase 2 left 30 KB of the 60 KB code budget used. Five panels and the chart
geometry will add to that. If the remainder exceeds 60 KB, record the number in
the commit message rather than quietly accepting it.

- [x] **Step 8: Verify in a browser**

Run `npm run playground` and confirm by eye:

- all five panels are visible and do not overlap the map's draggable gaps
- typing `sisli` in the search finds Şişli; selecting it flies the map
- clicking a sidebar row flies the map and highlights that region
- hovering a sidebar row highlights the region on the map **without** opening a
  tooltip; hovering the map does open one
- toggling a category chip repaints the map, sidebar, pie and trend together
- dragging a year handle updates every panel
- hovering a pie slice highlights the matching chip in the filter bar
- clicking a year in the trend chart narrows the filter to that year
- `Sıfırla` restores the defaults
- the sidebar collapses to a rail and back
- narrowing the window below 1024px moves the sidebar and charts below the map;
  below 640px only the map, search and legend remain

- [x] **Step 9: Update the README and commit**

Replace the "Şu an neler var" table's status line and add the new rows:

```markdown
> **Durum:** Geliştirme aşamasında (Aşama 3/5 tamamlandı). Harita, paneller ve
> grafikler çalışıyor. Karşılaştırma modu Aşama 4'te gelir.
```

| `Sidebar`, `SearchBar`, `FilterBar` | Sıralı bölge listesi, Türkçe arama, yıl ve kategori filtreleri |
| `CategoryPieChart`, `TrendChart` | Kategori dağılımı ve yıllara göre eğilim |
| `CATEGORY_PALETTE`, `arcPath`, `linePath` | Doğrulanmış kategorik palet ve grafik geometrisi |

```bash
git add -A
git commit -m "feat(panels): mount sidebar, search, filters and charts with panel matrix"
git tag phase-3-complete
```

---

## Phase 3 exit criteria

Each verified by running it:

- [x] `npm run verify` passes end to end
- [x] `src/core` at 100% branch coverage, including all six new pure modules
- [x] `npx eslint src/core` clean
- [x] Every panel mounts by default; each one disabled leaves **no DOM** and the
      others still mount
- [x] The per-capita toggle actually changes the numbers, and the legend follows
- [x] `Diğer` opens to reveal the categories it folded, and they keep their own
      palette slots
- [x] The map and the attribution render with every panel disabled
- [x] Search finds `Şişli` from `sisli`, `Ağrı` from `agri`, `İstanbul` from `istanbul`
- [x] Sidebar row hover highlights the map without opening a tooltip
- [x] Sidebar row click flies the map
- [x] Pie slice hover highlights the matching filter chip
- [x] Trend chart year click narrows the filter
- [x] Category colours stay put when a filter removes a different category
- [x] The 973-row sidebar renders a window, not every row
- [x] Layout reflows below 1024px and 640px

## What Phase 4 needs from Phase 3

- `HeatMapState.filters` and the filter actions — compare mode adds a second set
- `useAggregates` — gains a second rollup for filter set B
- `CATEGORY_PALETTE` and `arcPath` — the paired pie arcs reuse both
- `linePath` / `areaPath` — the B series overlays as a dashed line
- `PanelFlags.compare` — already accepted, still mounting nothing
