# Türkiye Suç Haritası — Phase 4 (Part 2 — The detail panel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Continues `docs/superpowers/plans/2026-08-01-phase-4-detail-and-light.md`. The
Global Constraints and the Decisions in that document apply to every task here.
Tasks 1–5 are complete before starting Task 6.

---

## Task 6: The detail slice, and why it outlives a level change

Clicking a province does two things at once: it flies the map in far enough to
cross the district threshold, **and** it opens that province's detail panel.

Those two fight each other under the Phase 2 rules. `setLevel` clears
`selectedCode` and `flyToRequest`, because a code like `"34"` names İstanbul at
province level and nothing at all at district level. If the detail target rode
along on `selectedCode`, the zoom the click started would close the panel the
same click opened.

So the detail target is its own slice, carrying **its own level**, and
`setLevel` leaves it alone.

**Files:**
- Modify: `src/context/HeatMapStore.ts`
- Modify: `src/context/HeatMapStore.test.ts`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`

**Interfaces:**
- Produces, added to `HeatMapState`:
  - `detail: DetailTarget | null`
- Produces: `DetailTarget` — `{ code: string; level: GeoLevel }`
- Produces, added to `HeatMapAction`:
  - `{ type: 'openDetail'; code: string; level: GeoLevel }`
  - `{ type: 'closeDetail' }`

- [ ] **Step 1: Write the failing tests**

Add to `src/context/HeatMapStore.test.ts`:

```ts
describe('region detail', () => {
  it('opens a detail target at a given level', () => {
    const next = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(next.detail).toEqual({ code: '34', level: 'il' });
  });

  it('selects the region it opened, so the map highlights it', () => {
    const next = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(next.selectedCode).toBe('34');
  });

  it('closes', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(heatMapReducer(open, { type: 'closeDetail' }).detail).toBeNull();
  });

  it('no-ops when closing an already-closed panel', () => {
    expect(heatMapReducer(base, { type: 'closeDetail' })).toBe(base);
  });

  /**
   * The whole reason the target carries its own level. Clicking a province
   * zooms to district level; if that zoom cleared the target, the click would
   * close the panel it just opened.
   */
  it('survives the level change that a province click triggers', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    const zoomed = heatMapReducer(open, { type: 'setLevel', level: 'ilce' });

    expect(zoomed.detail).toEqual({ code: '34', level: 'il' });
    // The selection does not survive — "34" means nothing at district level.
    expect(zoomed.selectedCode).toBeNull();
  });

  it('replaces the target when another region is opened', () => {
    let state = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    state = heatMapReducer(state, { type: 'openDetail', code: '3401', level: 'ilce' });
    expect(state.detail).toEqual({ code: '3401', level: 'ilce' });
  });

  it('closes when the view is reset', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(heatMapReducer(open, { type: 'resetView' }).detail).toBeNull();
  });
});
```

Add `detail: null` to the shared `base` fixture.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/context/HeatMapStore.test.ts`
Expected: FAIL — `detail` is not on `HeatMapState`.

- [ ] **Step 3: Implement**

In `src/context/HeatMapStore.ts`, add the type above `HeatMapState`:

```ts
/**
 * The region whose detail panel is open.
 *
 * Carries its own level rather than reading the active one: a province's panel
 * stays open after the click that opened it has zoomed the map to districts,
 * and at that point the active level no longer describes the target.
 */
export interface DetailTarget {
  code: string;
  level: GeoLevel;
}
```

to `HeatMapState`:

```ts
  detail: DetailTarget | null;
```

to `HeatMapAction`:

```ts
  | { type: 'openDetail'; code: string; level: GeoLevel }
  | { type: 'closeDetail' }
```

and to the reducer, before `default`:

```ts
    case 'openDetail':
      return {
        ...state,
        detail: { code: action.code, level: action.level },
        // Selecting it too is what keeps the region outlined on the map while
        // its panel is open.
        selectedCode: action.code,
      };

    case 'closeDetail':
      return state.detail === null ? state : { ...state, detail: null };
```

Extend `resetView` to close the panel — it is part of the view:

```ts
    case 'resetView':
      return {
        ...state,
        transform: IDENTITY_TRANSFORM,
        level: 'il',
        selectedCode: null,
        focusedCode: null,
        flyToRequest: null,
        detail: null,
      };
```

Leave `setLevel` alone. It must **not** touch `detail`.

- [ ] **Step 4: Seed it in the root**

In `src/components/CrimeHeatMap/CrimeHeatMap.tsx`, add `detail: null,` to the
`createHeatMapStore` call.

- [ ] **Step 5: Run, fix fixtures, commit**

```bash
npx vitest run src/context
npm run typecheck
```

Every `HeatMapState` fixture needs `detail: null`; the compiler lists them.

```bash
git add src/context src/components/CrimeHeatMap
git commit -m "feat(context): add a detail target that outlives a level change"
```

---

## Task 7: `useRegionDetail`

The panel needs a rollup for one region **at the target's own level**, which is
not necessarily the level the map is showing. Neither of `useAggregates`'
rollups can answer that after a province click has switched the map to
districts, so the detail gets its own.

**Files:**
- Create: `src/hooks/useRegionDetail.ts`
- Test: `src/hooks/useRegionDetail.test.tsx`

**Interfaces:**
- Consumes: `CrimeIndex`, `rollup` from `core/aggregation`; `getLevelRegionMeta`;
  `DetailTarget`.
- Produces:
  - `DetailCategory` — `{ id: string; label: string; value: number; share: number }`
  - `RegionDetailData` — `{ code: string; level: GeoLevel; name: string; total: number; categories: readonly DetailCategory[]; byYear: ReadonlyMap<number, number> }`
  - `useRegionDetail(index, categories, filters, detail): RegionDetailData | null`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useRegionDetail.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { useRegionDetail } from './useRegionDetail.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'a', count: 60 },
  { year: 2020, ilCode: '34', ilceCode: '3402', category: 'b', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'a', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'a', count: 10 },
];

const index = buildIndex({ data: DATA, categories: CATEGORIES });
const FILTERS: FilterSet = { yearRange: [2020, 2021], categories: [] };

describe('useRegionDetail', () => {
  it('returns nothing when no region is open', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, null),
    );
    expect(result.current).toBeNull();
  });

  it('totals a province across all of its districts', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current?.total).toBe(200);
  });

  it('names the region from the shipped geography', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current?.name).toBe('İstanbul');
  });

  /**
   * The case the whole hook exists for: the map is showing districts, but the
   * open panel belongs to a province.
   */
  it('rolls up at the target level, not the map level', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '3401', level: 'ilce' }),
    );
    expect(result.current?.name).toBe('Adalar');
    expect(result.current?.total).toBe(160);
  });

  it('breaks the total down by category, largest first', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    const cats = result.current!.categories;
    expect(cats[0]).toMatchObject({ id: 'a', label: 'Hırsızlık', value: 160 });
    expect(cats[1]).toMatchObject({ id: 'b', label: 'Darp', value: 40 });
  });

  it('computes each category share against the region total', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current!.categories[0]!.share).toBeCloseTo(0.8);
  });

  it('omits categories with no records in this region', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '06', level: 'il' }),
    );
    expect(result.current!.categories.map((c) => c.id)).toEqual(['a']);
  });

  it('breaks the total down by year', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current!.byYear.get(2020)).toBe(100);
    expect(result.current!.byYear.get(2021)).toBe(100);
  });

  it('honours the active filters', () => {
    const narrowed: FilterSet = { yearRange: [2021, 2021], categories: [] };
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, narrowed, { code: '34', level: 'il' }),
    );
    expect(result.current?.total).toBe(100);
  });

  it('returns a zeroed record for a region with no data rather than null', () => {
    // The panel was opened deliberately; saying "0" is a better answer than
    // silently refusing to open.
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '35', level: 'il' }),
    );
    expect(result.current?.total).toBe(0);
    expect(result.current?.name).toBe('İzmir');
    expect(result.current?.categories).toEqual([]);
  });

  it('is stable across renders with the same inputs', () => {
    const { result, rerender } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/hooks/useRegionDetail.test.tsx`
Expected: FAIL — module not found.

Note the stability test will need the target object to be referentially stable;
the hook memoizes on `detail?.code` and `detail?.level` rather than on the
object, so an inline literal is fine.

- [ ] **Step 3: Implement**

```ts
import { useMemo } from 'react';
import { rollup, type CrimeIndex } from '@/core/aggregation/index.js';
import type { DetailTarget } from '@/context/HeatMapStore.js';
import type { CrimeCategory, FilterSet, GeoLevel } from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';

export interface DetailCategory {
  id: string;
  label: string;
  value: number;
  /** Fraction of the region's total, 0..1. */
  share: number;
}

export interface RegionDetailData {
  code: string;
  level: GeoLevel;
  name: string;
  total: number;
  /** Largest first. Categories with no records here are omitted. */
  categories: readonly DetailCategory[];
  byYear: ReadonlyMap<number, number>;
}

/**
 * Everything the detail panel shows, for one region.
 *
 * Rolls up at the *target's* level rather than the map's. Those differ by
 * design: clicking a province zooms the map to districts while its panel stays
 * open, so reading the active level here would total the wrong thing — or
 * nothing at all, since a province code does not appear in a district rollup.
 */
export function useRegionDetail(
  index: CrimeIndex,
  categories: readonly CrimeCategory[],
  filters: FilterSet,
  detail: DetailTarget | null,
): RegionDetailData | null {
  const code = detail?.code ?? null;
  const level = detail?.level ?? null;

  return useMemo(() => {
    if (code === null || level === null) return null;

    const rolled = rollup(index, level, filters);
    const aggregate = rolled.byRegion.get(code);
    const name = getLevelRegionMeta(level).get(code)?.name ?? code;

    // A region the consumer's data never mentions still deserves a panel: it
    // was opened on purpose, and "0" answers the question that was asked.
    if (aggregate === undefined) {
      return { code, level, name, total: 0, categories: [], byYear: new Map() };
    }

    const labels = new Map(categories.map((category) => [category.id, category.label]));
    const breakdown: DetailCategory[] = [...aggregate.byCategory.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => ({
        id,
        label: labels.get(id) ?? id,
        value,
        share: aggregate.total === 0 ? 0 : value / aggregate.total,
      }));

    return {
      code,
      level,
      name,
      total: aggregate.total,
      categories: breakdown,
      byYear: aggregate.byYear,
    };
  }, [index, categories, filters, code, level]);
}
```

- [ ] **Step 4: Run and commit**

```bash
npx vitest run src/hooks/useRegionDetail.test.tsx
npm run typecheck && npm run lint
```

Expected: PASS, 11 tests.

```bash
git add src/hooks/useRegionDetail.ts src/hooks/useRegionDetail.test.tsx
git commit -m "feat(hooks): add region detail rollup at the target's own level"
```

---

## Task 8: The `RegionDetail` panel

A slide-in surface holding three things: the category table on the left, the
donut, and the yearly line. The map stays visible behind it.

The donut and the line reuse `CategoryPieChart` and `TrendChart` unchanged —
both already take exactly the data this panel has, and re-implementing them
here would mean two chart implementations drifting apart.

**Files:**
- Create: `src/components/RegionDetail/RegionDetail.tsx`
- Create: `src/components/RegionDetail/RegionCategoryList.tsx`
- Create: `src/components/RegionDetail/RegionDetail.module.css`
- Create: `src/components/RegionDetail/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`, `src/i18n/index.ts`
- Test: `src/components/RegionDetail/RegionDetail.test.tsx`

**Interfaces:**
- Consumes: `RegionDetailData`; `CategoryPieChart`, `TrendChart`, `GlassPanel`.
- Produces: `RegionDetail` — `(props: { detail: RegionDetailData; categories: readonly CrimeCategory[]; onClose: () => void }) => JSX.Element`
- Produces, added to `Strings`:
  ```ts
  detail: {
    close: string; total: string; categories: string;
    empty: string; levelIl: string; levelIlce: string;
  };
  ```

- [ ] **Step 1: Add the strings**

`src/i18n/types.ts`:

```ts
  detail: {
    close: string;
    total: string;
    categories: string;
    empty: string;
    /** Shown beside the region name so the unit is never ambiguous. */
    levelIl: string;
    levelIlce: string;
  };
```

`src/i18n/tr.ts`:

```ts
  detail: {
    close: 'Detayı kapat',
    total: 'Toplam',
    categories: 'Suç türleri',
    empty: 'Bu bölge için kayıt yok',
    levelIl: 'İl',
    levelIlce: 'İlçe',
  },
```

Add `detail: mergeGroup('detail', overrides),` to `src/i18n/index.ts`.

- [ ] **Step 2: Write the failing test**

Create `src/components/RegionDetail/RegionDetail.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import type { RegionDetailData } from '@/hooks/useRegionDetail.js';
import { trStrings } from '@/i18n/index.js';
import { RegionDetail } from './RegionDetail.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
];

const DETAIL: RegionDetailData = {
  code: '34',
  level: 'il',
  name: 'İstanbul',
  total: 200,
  categories: [
    { id: 'a', label: 'Hırsızlık', value: 160, share: 0.8 },
    { id: 'b', label: 'Darp', value: 40, share: 0.2 },
  ],
  byYear: new Map([[2020, 100], [2021, 100]]),
};

const DEFAULTS = { yearRange: [2020, 2021] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: '34',
  filters: DEFAULTS,
  defaultFilters: DEFAULTS,
  yearBounds: [2020, 2021],
  flyToRequest: null,
  detail: { code: '34', level: 'il' },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderDetail(detail: RegionDetailData = DETAIL, onClose = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <RegionDetail detail={detail} categories={CATEGORIES} onClose={onClose} />,
    { wrapper },
  );
  return { ...utils, onClose };
}

describe('RegionDetail', () => {
  it('is a labelled dialog naming the region', () => {
    renderDetail();
    expect(screen.getByRole('dialog', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('says which administrative level the region is', () => {
    renderDetail();
    expect(screen.getByText(trStrings.detail.levelIl)).toBeInTheDocument();
  });

  it('says İlçe for a district', () => {
    renderDetail({ ...DETAIL, level: 'ilce', code: '3401', name: 'Adalar' });
    expect(screen.getByText(trStrings.detail.levelIlce)).toBeInTheDocument();
  });

  it('shows the region total', () => {
    renderDetail();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('lists every category with its value and share', () => {
    renderDetail();
    expect(screen.getByText('Hırsızlık')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('%80,0')).toBeInTheDocument();
  });

  it('renders the donut', () => {
    renderDetail();
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
  });

  it('renders the yearly chart', () => {
    renderDetail();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });

  it('closes on the close button', () => {
    const { onClose } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: trStrings.detail.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape, so the keyboard can dismiss it', () => {
    const { onClose } = renderDetail();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says so for a region with no records rather than rendering empty charts', () => {
    renderDetail({ ...DETAIL, total: 0, categories: [], byYear: new Map() });
    expect(screen.getByText(trStrings.detail.empty)).toBeInTheDocument();
  });

  it('does not cover the whole component, so the map stays visible', () => {
    const { container } = renderDetail();
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    // A full-bleed inset would hide the map behind it.
    expect(dialog.className).not.toMatch(/fullscreen/u);
  });
});
```

- [ ] **Step 3: Implement the category list**

`src/components/RegionDetail/RegionCategoryList.tsx`:

```tsx
import { categoryColor } from '@/core/chart/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import type { DetailCategory } from '@/hooks/useRegionDetail.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './RegionDetail.module.css';

export interface RegionCategoryListProps {
  categories: readonly DetailCategory[];
  /** The dataset's own order, which is what fixes each category's colour. */
  order: readonly CrimeCategory[];
}

/**
 * The region's categories as a table.
 *
 * A table rather than a list because it is three aligned columns of numbers,
 * and because it doubles as the accessible equivalent of the donut beside it.
 */
export function RegionCategoryList({ categories, order }: RegionCategoryListProps) {
  const strings = useStrings();

  // Keyed off the dataset's own order, exactly as the donut does, so the two
  // agree. Colour follows the category, never its rank in this table.
  const colorById = new Map(order.map((category, index) => [
    category.id,
    category.color ?? categoryColor(index),
  ]));

  return (
    <table className={styles.table}>
      <caption className={styles.tableCaption}>{strings.detail.categories}</caption>
      <tbody>
        {categories.map((category) => (
          <tr key={category.id} className={styles.row}>
            <td className={styles.swatchCell}>
              <span
                className={styles.swatch}
                style={{ background: colorById.get(category.id) }}
                aria-hidden="true"
              />
            </td>
            <th scope="row" className={styles.rowLabel}>{category.label}</th>
            <td className={styles.rowValue}>{formatTrNumber(category.value)}</td>
            <td className={styles.rowShare}>{formatPercent(category.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Implement the panel**

`src/components/RegionDetail/RegionDetail.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CategoryPieChart } from '@/components/CategoryPieChart/index.js';
import { TrendChart } from '@/components/TrendChart/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import type { RegionDetailData } from '@/hooks/useRegionDetail.js';
import { RegionCategoryList } from './RegionCategoryList.js';
import styles from './RegionDetail.module.css';

export interface RegionDetailProps {
  detail: RegionDetailData;
  categories: readonly CrimeCategory[];
  onClose: () => void;
}

export function RegionDetail({ detail, categories, onClose }: RegionDetailProps) {
  const strings = useStrings();
  const ref = useRef<HTMLDivElement | null>(null);

  // Focus the panel on open so Escape reaches it and a screen reader announces
  // the region that was just opened.
  useEffect(() => { ref.current?.focus(); }, [detail.code, detail.level]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  }, [onClose]);

  const totals = useMemo(
    () => new Map(detail.categories.map((category) => [category.id, category.value])),
    [detail.categories],
  );

  const isEmpty = detail.total === 0;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal={false}
      aria-label={detail.name}
      tabIndex={-1}
      className={styles.panel}
      onKeyDown={onKeyDown}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2 className={styles.name}>{detail.name}</h2>
          <span className={styles.level}>
            {detail.level === 'il' ? strings.detail.levelIl : strings.detail.levelIlce}
          </span>
        </div>
        <p className={styles.total}>
          <span className={styles.totalLabel}>{strings.detail.total}</span>
          <span className={styles.totalValue}>{formatTrNumber(detail.total)}</span>
        </p>
        <button
          type="button"
          className={styles.close}
          aria-label={strings.detail.close}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {isEmpty ? (
        <p className={styles.empty}>{strings.detail.empty}</p>
      ) : (
        <div className={styles.body}>
          <div className={styles.listColumn}>
            <RegionCategoryList categories={detail.categories} order={categories} />
          </div>
          <CategoryPieChart
            categories={categories}
            totals={totals}
            regionName={detail.name}
            onHoverCategory={() => {}}
          />
          <TrendChart byYear={detail.byYear} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Style it**

`src/components/RegionDetail/RegionDetail.module.css`:

```css
/*
 * Anchored to the bottom rather than filling the frame: the map has to stay
 * visible with the opened region still highlighted on it, which is the whole
 * reason this is a panel and not a page.
 */
.panel {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 30;
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--hm-radius);
  background: var(--hm-glass-bg-solid);
  border: 1px solid var(--hm-glass-border);
  box-shadow: var(--hm-glass-shadow);
  pointer-events: auto;
  animation: slideIn var(--hm-motion-panel) var(--hm-ease-panel);
}

@keyframes slideIn {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.panel:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 2px; }

.header {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.identity { display: flex; align-items: baseline; gap: 8px; }
.name { margin: 0; font-size: 15px; font-weight: 600; color: var(--hm-fg); }

.level {
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--hm-glass-border);
  font-size: 10px;
  color: var(--hm-fg-muted);
}

.total { display: flex; align-items: baseline; gap: 6px; margin: 0; }
.totalLabel { font-size: 11px; color: var(--hm-fg-muted); }
.totalValue { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }

.close {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--hm-fg-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.close:hover { background: rgba(15, 23, 42, 0.06); color: var(--hm-fg); }
.close:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 2px; }

.body {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto auto;
  gap: 14px;
  align-items: start;
}

.listColumn { min-width: 0; max-height: 220px; overflow-y: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 12px; }

.tableCaption {
  text-align: left;
  padding-bottom: 4px;
  font-size: 11px;
  color: var(--hm-fg-muted);
}

.row { border-bottom: 1px solid var(--hm-glass-border); }
.swatchCell { width: 14px; padding: 3px 0; }
.swatch { display: block; width: 8px; height: 8px; border-radius: 2px; }
.rowLabel { padding: 3px 6px; text-align: left; font-weight: 400; color: var(--hm-fg); }
.rowValue { padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums; }

.rowShare {
  padding: 3px 0 3px 6px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--hm-fg-muted);
}

.empty { margin: 0; padding: 12px 0; font-size: 12px; color: var(--hm-fg-muted); }
```

- [ ] **Step 6: Write the barrel, run and commit**

`src/components/RegionDetail/index.ts`:

```ts
export type { RegionDetailProps } from './RegionDetail.js';
export { RegionDetail } from './RegionDetail.js';
```

```bash
npx vitest run src/components/RegionDetail src/i18n
npm run typecheck && npm run lint
```

Expected: PASS, 11 tests.

```bash
git add src/components/RegionDetail src/i18n
git commit -m "feat(detail): add the region detail panel"
```

---

## Task 9: Wire the click-through, then verify the phase

Clicking a district opens its panel. Clicking a province opens its panel **and**
flies the map in, which crosses the district threshold on its own — the fitted
transform for even the largest province lands well above the 2.65 switch point.

**Files:**
- Modify: `src/components/MapCanvas/MapCanvas.tsx`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`
- Modify: `src/components/MapCanvas/MapCanvas.test.tsx`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write the failing map test**

Add to `src/components/MapCanvas/MapCanvas.test.tsx`:

```tsx
describe('MapCanvas — opening a region detail', () => {
  it('opens the detail panel for a clicked province', () => {
    const { container, store } = renderCanvas();
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(store.getState().detail).toEqual({ code: '34', level: 'il' });
  });

  it('also flies toward a clicked province, which crosses the district threshold', () => {
    const { container, store } = renderCanvas();
    const before = store.getState().transform;

    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(store.getState().transform).not.toEqual(before);
    expect(store.getState().transform.k).toBeGreaterThan(2.65);
  });

  it('keeps the province panel open through the level change the zoom causes', () => {
    const { container, store } = renderCanvas();
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    act(() => { store.dispatch({ type: 'setLevel', level: 'ilce' }); });
    expect(store.getState().detail).toEqual({ code: '34', level: 'il' });
  });

  it('opens a district panel without flying, since it is already in view', () => {
    const { container, store } = renderCanvas({
      ...base, level: 'ilce', transform: { k: 3, x: 0, y: 0 },
    });
    const district = container.querySelector('path[role="img"]') as SVGPathElement;
    const code = district.getAttribute('data-code')!;
    const before = store.getState().transform;

    district.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(store.getState().detail).toEqual({ code, level: 'ilce' });
    expect(store.getState().transform).toEqual(before);
  });
});
```

- [ ] **Step 2: Implement the click behaviour**

In `src/components/MapCanvas/MapCanvas.tsx`, replace the body of `onSelect`:

```tsx
  const onSelect = useCallback((code: string | null) => {
    if (code === null) {
      dispatch({ type: 'select', code: null });
      dispatch({ type: 'closeDetail' });
      return;
    }

    dispatch({ type: 'openDetail', code, level });

    // A province click also zooms in. Fitting even the largest province to the
    // viewport lands well past the 2.65 district threshold, so the level
    // switches on its own — the detail target carries its own level precisely
    // so that switch does not close the panel this click just opened.
    if (level === 'il') dispatch({ type: 'requestFlyTo', code });

    if (onRegionClick === undefined) return;
    onRegionClick({
      code,
      name: names.get(code) ?? code,
      value: values.get(code) ?? null,
    });
  }, [dispatch, level, onRegionClick, names, values]);
```

- [ ] **Step 3: Mount the panel**

In `src/components/CrimeHeatMap/CrimeHeatMap.tsx`, inside `Content`:

```tsx
  const detailTarget = useHeatMapState((state) => state.detail);
  const filters = useHeatMapState((state) => state.filters);
  const detail = useRegionDetail(index, categories, filters, detailTarget);
```

`index` is not currently returned into `Content` — take it from the same
`useAggregates` call:

```tsx
  const { index, rollup, scale, names } = useAggregates({
    data, categories, colorScale, population,
  });
```

and render it after the overlay, before the tooltip:

```tsx
      {detail === null ? null : (
        <RegionDetail
          detail={detail}
          categories={categories}
          onClose={() => { dispatch({ type: 'closeDetail' }); }}
        />
      )}
```

with `const dispatch = useHeatMapDispatch();` in `Content`, and the imports:

```tsx
import { RegionDetail } from '@/components/RegionDetail/index.js';
import { useRegionDetail } from '@/hooks/useRegionDetail.js';
import { useHeatMapDispatch, useHeatMapState } from '@/hooks/useHeatMapState.js';
```

- [ ] **Step 4: Cover it at the root**

Add to `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`:

```tsx
describe('CrimeHeatMap — region detail', () => {
  it('shows no detail panel until a region is clicked', () => {
    renderMap();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the panel for a clicked region', () => {
    const { container } = renderMap();
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(screen.getByRole('dialog', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('closes the panel again', () => {
    const { container } = renderMap();
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fireEvent.click(screen.getByRole('button', { name: trStrings.detail.close }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the map mounted behind the panel', () => {
    const { container } = renderMap();
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });
});
```

Import `fireEvent` in that file if it is not already imported.

- [ ] **Step 5: Run the full verification**

```bash
npm run verify
```

Every line must pass:
- `typecheck` — no errors
- `lint` — clean, including the `core/`-purity rule and `react-hooks/exhaustive-deps`
- all tests pass
- `src/core` at **100% branch coverage**

```bash
npx eslint src/core --max-warnings 0
npm run build
node -e "const{gzipSync}=require('node:zlib'),fs=require('fs');const b=fs.readFileSync('dist/index.mjs');const g=['il','ilce'].reduce((n,l)=>n+gzipSync(fs.readFileSync('src/data/geo/turkiye-'+l+'.topo.json'),{level:9}).byteLength,0);const t=gzipSync(b,{level:9}).byteLength;const c=gzipSync(fs.readFileSync('dist/style.css'),{level:9}).byteLength;const k=x=>Math.round(x/1024)+'KB';console.log('total',k(t),'| geo',k(g),'(120KB)','| code+css',k(t-g+c),'(60KB)');"
```

- [ ] **Step 6: Verify in a browser**

Run `npm run playground` and confirm by eye:

- the whole component is light: pale map, light panels, dark text and borders
- the heat still reads as a ramp — low values pale, high values deep red — and
  the mid-range is visible rather than washed out
- the legend swatches match the map fills
- the filter bar is a button; opening it reveals the slider and chips; a badge
  appears on the button when a filter is active
- clicking a province zooms in to districts **and** opens its panel, which stays
  open through the zoom
- clicking a district opens its panel without moving the map
- the panel shows the category table, the donut and the yearly line
- the clicked region stays outlined on the map behind the panel
- Escape and the × both close it
- resizing the window never moves a panel to a different corner

- [ ] **Step 7: Update the README and commit**

Change the status line:

```markdown
> **Durum:** Geliştirme aşamasında (Aşama 4/5 tamamlandı). Açık tema, bölge
> detay paneli ve katlanabilir filtreler eklendi.
```

Add to the feature table:

```markdown
| `RegionDetail` | Bölgeye tıklayınca açılan detay paneli: kategori tablosu, halka grafik ve yıllık eğilim |
```

Replace the dark-theme design note with the light-theme reasoning:

```markdown
- **Açık tema, tek tema.** Harita rampası açık zemin için yeniden türetildi:
  her durak bir hedef parlaklığa çözüldü, böylece büyüklük yalnızca renk
  tonuyla değil açıklıkla da okunuyor. Önceki rampa ortada açık renkliydi ve
  açık zeminde orta değerler 1,36 kontrastla kayboluyordu.
```

```bash
git add -A
git commit -m "feat(detail): open a region detail panel on click"
git tag phase-4-complete
```

---

## Phase 4 exit criteria

Each verified by running it:

- [ ] `npm run verify` passes end to end
- [ ] `src/core` at 100% branch coverage
- [ ] `npx eslint src/core` clean
- [ ] The spectral ramp darkens monotonically and its lowest step recedes
- [ ] The chart palette is the light-surface column, with the pie's labels intact
- [ ] No `prefers-color-scheme` anywhere — light is the only theme
- [ ] No media-query breakpoints; every panel keeps its corner at any width
- [ ] The filter bar is collapsed by default and badges its active-filter count
- [ ] A province click opens its panel **and** zooms past the district threshold
- [ ] The province panel survives the level change that zoom causes
- [ ] A district click opens its panel without moving the map
- [ ] The map stays mounted and the region stays outlined behind the panel
- [ ] Escape closes the panel

## What Phase 5 needs from Phase 4

- `DetailTarget` and the `openDetail`/`closeDetail` actions — compare mode adds
  a second series to the same panel
- `useRegionDetail` — gains a filter-set-B rollup alongside the current one
- The light ramps — the diverging diff scale needs the same re-derivation
  against the light canvas before compare mode can use it
