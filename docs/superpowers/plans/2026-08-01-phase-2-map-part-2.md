# Türkiye Suç Haritası — Phase 2: Map (Part 2 — Rendering)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Continues `docs/superpowers/plans/2026-08-01-phase-2-map.md`. The Global
Constraints in that document apply to every task here. Tasks 1–6 are complete
before starting Task 7.

---

## Task 7: Memoized aggregation and colour scale

Everything the map paints comes from here: the validated index, the per-level
rollup for the active filters, and the colour scale built from that rollup's
values. Memoizing it in one place is what keeps a filter change under the 100 ms
budget in §9 — and is why `data` and `categories` must be compared by reference
(§8).

**Files:**
- Create: `src/hooks/useAggregates.ts`
- Test: `src/hooks/useAggregates.test.tsx`

**Interfaces:**
- Consumes: `buildIndex`, `rollup`, `createColorScale` from `core/`; `getLevelRegionMeta`, `getLevelFeatures` from Task 4; `useHeatMapState` from Task 5.
- Produces:
  - `AggregateResult` — `{ index: CrimeIndex; rollup: RollupResult; scale: ColorScale; names: ReadonlyMap<string, string> }`
  - `useAggregates(data, categories): AggregateResult`
  - `AggregatesInput` — `{ data: readonly CrimeRecord[]; categories: readonly CrimeCategory[]; colorScale: ColorScaleName | RampFn }`

- [x] **Step 1: Write the failing test**

Create `src/hooks/useAggregates.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { useAggregates } from './useAggregates.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'hirsizlik', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'darp', count: 10 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2021], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function setup(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

describe('useAggregates', () => {
  it('rolls up totals for the active level', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
    expect(result.current.rollup.byRegion.get('06')?.total).toBe(40);
  });

  it('narrows to the filtered year range', () => {
    const { wrapper } = setup({ ...base, filters: { yearRange: [2021, 2021], categories: [] } });
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(10);
    expect(result.current.rollup.byRegion.has('06')).toBe(false);
  });

  it('switches to district codes at ilçe level', () => {
    const { wrapper } = setup({ ...base, level: 'ilce' });
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.rollup.byRegion.get('3401')?.total).toBe(110);
  });

  it('builds a colour scale over the rollup values', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.scale.domain.min).toBe(40);
    expect(result.current.scale.domain.max).toBe(110);
    expect(result.current.scale(110)).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('resolves region names from the bundled geography', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.names.get('34')).toBe('İstanbul');
  });

  it('does not rebuild the index when only the transform moves', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    const before = result.current.index;

    act(() => { store.dispatch({ type: 'setTransform', transform: { k: 4, x: 1, y: 2 } }); });
    expect(result.current.index).toBe(before);
  });

  it('rebuilds the rollup when filters change', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: DATA, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    const before = result.current.rollup;

    act(() => {
      store.dispatch({
        type: 'setFilters',
        filters: { yearRange: [2021, 2021], categories: [] },
      });
    });
    expect(result.current.rollup).not.toBe(before);
  });

  it('surfaces validation warnings instead of throwing on bad records', () => {
    const bad: CrimeRecord[] = [
      { year: 2020, ilCode: '99', category: 'hirsizlik', count: 5 },
    ];
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: bad, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.index.warnings.length).toBeGreaterThan(0);
    expect(result.current.rollup.total).toBe(0);
  });

  it('survives an empty dataset', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: [], categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.rollup.total).toBe(0);
    expect(() => result.current.scale(0)).not.toThrow();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useAggregates.test.tsx`
Expected: FAIL — cannot resolve `./useAggregates.js`.

- [x] **Step 3: Implement `src/hooks/useAggregates.ts`**

```ts
import { useMemo } from 'react';
import {
  buildIndex, rollup, type CrimeIndex, type RollupResult,
} from '@/core/aggregation/index.js';
import {
  createColorScale, type ColorScale, type ColorScaleName, type RampFn,
} from '@/core/color/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { useHeatMapState } from './useHeatMapState.js';

export interface AggregatesInput {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  colorScale: ColorScaleName | RampFn;
}

export interface AggregateResult {
  index: CrimeIndex;
  rollup: RollupResult;
  scale: ColorScale;
  /** Region code → display name, for tooltip and legend labels. */
  names: ReadonlyMap<string, string>;
}

/**
 * The single path from raw records to something paintable.
 *
 * Three separate memos, not one, because they invalidate on different things:
 * the index only on the data identity, the rollup on filters and level, the
 * scale on the rollup's values. Collapsing them would rebuild and re-validate
 * ~78k records on every filter tick and blow the §9 budget.
 *
 * `data` and `categories` are compared by reference (§8) — a consumer that
 * builds either array inline in render defeats all of this.
 */
export function useAggregates(input: AggregatesInput): AggregateResult {
  const { data, categories, colorScale } = input;
  const level = useHeatMapState((state) => state.level);
  const filters = useHeatMapState((state) => state.filters);
  const scaleMode = useHeatMapState((state) => state.scaleMode);

  const names = useMemo(() => {
    const meta = getLevelRegionMeta(level);
    return new Map([...meta].map(([code, region]) => [code, region.name]));
  }, [level]);

  const index = useMemo(() => {
    const knownIlceCodes = new Set(getLevelRegionMeta('ilce').keys());
    return buildIndex({ data, categories, knownIlceCodes });
  }, [data, categories]);

  const rolled = useMemo(() => rollup(index, level, filters), [index, level, filters]);

  // Domains are computed per level: il and ilçe magnitudes differ by an order of
  // magnitude and must not share a scale (§6.5).
  const scale = useMemo(
    () => createColorScale({ values: rolled.values, mode: scaleMode, ramp: colorScale }),
    [rolled, scaleMode, colorScale],
  );

  return { index, rollup: rolled, scale, names };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useAggregates.test.tsx`
Expected: PASS, 9 tests.

The "does not rebuild the index" test is the one that protects the performance
budget. If it fails, something upstream is producing a new `data` reference.

- [x] **Step 5: Commit**

```bash
git add src/hooks/useAggregates.ts src/hooks/useAggregates.test.tsx
git commit -m "feat(hooks): add memoized aggregation and colour scale"
```

---

## Task 8: Pan, zoom, and level switching

Pan and zoom are a `transform` on one group; the blur filter must not re-run
while dragging. Level derivation carries hysteresis so scrolling across the
threshold does not flicker (§7.1).

**Files:**
- Create: `src/core/geo/zoom.ts`
- Create: `src/hooks/useMapZoom.ts`
- Test: `src/core/geo/zoom.test.ts`
- Test: `src/hooks/useMapZoom.test.tsx`

**Interfaces:**
- Consumes: `Transform`, `Viewport`, `GeoLevel`; `LEVEL_THRESHOLD`, `LEVEL_HYSTERESIS` from Task 4.
- Produces (pure, in `core/`):
  - `MIN_ZOOM = 1`, `MAX_ZOOM = 12`
  - `clampTransform(t: Transform, viewport: Viewport): Transform`
  - `zoomAt(t: Transform, factor: number, point: [number, number], viewport: Viewport): Transform`
  - `panBy(t: Transform, dx: number, dy: number, viewport: Viewport): Transform`
  - `deriveLevel(k: number, current: GeoLevel, threshold: number, hysteresis: number): GeoLevel`
- Produces (React): `useMapZoom(viewport): { transform, level, handlers, zoomIn, zoomOut, reset }`

- [x] **Step 1: Write the failing pure test**

Zoom math is pure, so it belongs in `core/` and must hit 100% branch coverage.

Create `src/core/geo/zoom.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Transform, Viewport } from '@/core/types/index.js';
import { MAX_ZOOM, MIN_ZOOM, clampTransform, deriveLevel, panBy, zoomAt } from './zoom.js';

const VIEWPORT: Viewport = { width: 1000, height: 600 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

describe('clampTransform', () => {
  it('holds the scale within bounds', () => {
    expect(clampTransform({ k: 0.2, x: 0, y: 0 }, VIEWPORT).k).toBe(MIN_ZOOM);
    expect(clampTransform({ k: 99, x: 0, y: 0 }, VIEWPORT).k).toBe(MAX_ZOOM);
  });

  it('pins the content at identity so the map cannot be dragged off-screen', () => {
    expect(clampTransform({ k: 1, x: 500, y: 400 }, VIEWPORT)).toEqual(IDENTITY);
  });

  it('allows panning proportional to the zoom level', () => {
    const panned = clampTransform({ k: 3, x: -1200, y: 0 }, VIEWPORT);
    // At k=3 the content is 3x the viewport, so 2 viewports of travel exist.
    expect(panned.x).toBe(-(VIEWPORT.width * (3 - 1)));
    expect(panned.x).toBeLessThan(0);
  });

  it('never allows positive overscroll past the left edge', () => {
    expect(clampTransform({ k: 3, x: 200, y: 0 }, VIEWPORT).x).toBe(0);
  });

  it('treats a zero-sized viewport as unmeasured and returns identity', () => {
    expect(clampTransform({ k: 5, x: 10, y: 10 }, { width: 0, height: 0 })).toEqual(IDENTITY);
  });
});

describe('zoomAt', () => {
  it('keeps the anchor point stationary', () => {
    const anchor: [number, number] = [400, 300];
    const zoomed = zoomAt(IDENTITY, 2, anchor, VIEWPORT);
    // World point under the cursor before and after must match.
    const before = (anchor[0] - IDENTITY.x) / IDENTITY.k;
    const after = (anchor[0] - zoomed.x) / zoomed.k;
    expect(after).toBeCloseTo(before, 6);
  });

  it('scales by the factor', () => {
    expect(zoomAt(IDENTITY, 2, [500, 300], VIEWPORT).k).toBe(2);
  });

  it('refuses to zoom below the minimum', () => {
    expect(zoomAt(IDENTITY, 0.1, [500, 300], VIEWPORT).k).toBe(MIN_ZOOM);
  });

  it('refuses to zoom above the maximum', () => {
    expect(zoomAt({ k: MAX_ZOOM, x: 0, y: 0 }, 4, [500, 300], VIEWPORT).k).toBe(MAX_ZOOM);
  });

  it('is a no-op on an unmeasured viewport', () => {
    expect(zoomAt(IDENTITY, 2, [0, 0], { width: 0, height: 0 })).toEqual(IDENTITY);
  });
});

describe('panBy', () => {
  it('moves the transform', () => {
    const panned = panBy({ k: 3, x: -100, y: -100 }, -50, -25, VIEWPORT);
    expect(panned.x).toBe(-150);
    expect(panned.y).toBe(-125);
  });

  it('clamps at the edge', () => {
    expect(panBy({ k: 2, x: 0, y: 0 }, 100, 0, VIEWPORT).x).toBe(0);
  });
});

describe('deriveLevel', () => {
  const T = 2.5;
  const H = 0.15;

  it('shows provinces well below the threshold', () => {
    expect(deriveLevel(1, 'il', T, H)).toBe('il');
  });

  it('shows districts well above the threshold', () => {
    expect(deriveLevel(6, 'il', T, H)).toBe('ilce');
  });

  it('only switches up once past threshold + hysteresis', () => {
    expect(deriveLevel(T + H - 0.01, 'il', T, H)).toBe('il');
    expect(deriveLevel(T + H + 0.01, 'il', T, H)).toBe('ilce');
  });

  it('only switches down once past threshold - hysteresis', () => {
    expect(deriveLevel(T - H + 0.01, 'ilce', T, H)).toBe('ilce');
    expect(deriveLevel(T - H - 0.01, 'ilce', T, H)).toBe('il');
  });

  it('holds the current level throughout the dead band, in both directions', () => {
    for (const k of [T - H, T, T + H]) {
      expect(deriveLevel(k, 'il', T, H)).toBe('il');
      expect(deriveLevel(k, 'ilce', T, H)).toBe('ilce');
    }
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/geo/zoom.test.ts`
Expected: FAIL — cannot resolve `./zoom.js`.

- [x] **Step 3: Implement `src/core/geo/zoom.ts`**

```ts
import type { GeoLevel, Transform, Viewport } from '@/core/types/index.js';

/** Zoom range from §7.1. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Constrains scale to [MIN_ZOOM, MAX_ZOOM] and translation so the content
 * always covers the viewport.
 *
 * At scale k the content is k times the viewport, leaving (k-1) viewports of
 * travel in each axis. At k=1 there is none, so the only legal transform is
 * identity — which is why the map cannot be dragged away from its frame.
 */
export function clampTransform(transform: Transform, viewport: Viewport): Transform {
  if (viewport.width <= 0 || viewport.height <= 0) return IDENTITY;

  const k = clamp(transform.k, MIN_ZOOM, MAX_ZOOM);
  const maxPanX = viewport.width * (k - 1);
  const maxPanY = viewport.height * (k - 1);

  return {
    k,
    x: clamp(transform.x, -maxPanX, 0),
    y: clamp(transform.y, -maxPanY, 0),
  };
}

/**
 * Scales about a screen point, keeping whatever is under that point fixed.
 *
 * Anchoring on the pointer is what makes wheel-zoom feel direct rather than
 * like the map jumping to centre.
 */
export function zoomAt(
  transform: Transform,
  factor: number,
  point: readonly [number, number],
  viewport: Viewport,
): Transform {
  if (viewport.width <= 0 || viewport.height <= 0) return IDENTITY;

  const k = clamp(transform.k * factor, MIN_ZOOM, MAX_ZOOM);
  // Solve for the translation that leaves `point` over the same world position.
  const worldX = (point[0] - transform.x) / transform.k;
  const worldY = (point[1] - transform.y) / transform.k;

  return clampTransform(
    { k, x: point[0] - worldX * k, y: point[1] - worldY * k },
    viewport,
  );
}

export function panBy(
  transform: Transform,
  dx: number,
  dy: number,
  viewport: Viewport,
): Transform {
  return clampTransform(
    { k: transform.k, x: transform.x + dx, y: transform.y + dy },
    viewport,
  );
}

/**
 * Chooses the geography level for a zoom scale, with a dead band around the
 * threshold.
 *
 * Without hysteresis, a scale resting near the threshold flips level on every
 * pixel of scroll, re-decoding 973 polygons each time. The band means a switch
 * requires committing past it, and the level then sticks until the scale
 * crosses back past the far edge.
 */
export function deriveLevel(
  k: number,
  current: GeoLevel,
  threshold: number,
  hysteresis: number,
): GeoLevel {
  if (k > threshold + hysteresis) return 'ilce';
  if (k < threshold - hysteresis) return 'il';
  return current;
}
```

- [x] **Step 4: Run the pure test and check coverage**

```bash
npx vitest run src/core/geo/zoom.test.ts
npx vitest run --coverage
```

Expected: PASS, 17 tests, and `zoom.ts` at 100% on all four coverage columns.
`core/` coverage is enforced at 100% — a missed branch fails the build.

- [x] **Step 5: Export from the geo barrel**

Add to `src/core/geo/index.ts`:

```ts
export { MAX_ZOOM, MIN_ZOOM, clampTransform, deriveLevel, panBy, zoomAt } from './zoom.js';
```

- [x] **Step 6: Write the failing hook test**

Create `src/hooks/useMapZoom.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { useMapZoom } from './useMapZoom.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function setup(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

const VIEWPORT = { width: 1000, height: 600 };

describe('useMapZoom', () => {
  it('starts at identity', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });
    expect(result.current.transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('zooms in and out through the exposed controls', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.zoomIn(); });
    expect(result.current.transform.k).toBeGreaterThan(1);

    const zoomed = result.current.transform.k;
    act(() => { result.current.zoomOut(); });
    expect(result.current.transform.k).toBeLessThan(zoomed);
  });

  it('switches to ilçe once zoomed past the threshold', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { for (let i = 0; i < 6; i += 1) result.current.zoomIn(); });
    expect(result.current.transform.k).toBeGreaterThan(2.65);
    expect(store.getState().level).toBe('ilce');
  });

  it('does not flicker level while the scale sits inside the dead band', () => {
    const { store, wrapper } = setup({ ...base, transform: { k: 2.5, x: 0, y: 0 } });
    renderHook(() => useMapZoom(VIEWPORT), { wrapper });
    expect(store.getState().level).toBe('il');
  });

  it('resets the view', () => {
    const { wrapper } = setup({ ...base, transform: { k: 5, x: -100, y: -50 }, level: 'ilce' });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.reset(); });
    expect(result.current.transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('zooms toward the pointer on wheel', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onWheel({
        deltaY: -100,
        clientX: 200,
        clientY: 150,
        currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
        preventDefault: () => {},
      } as never);
    });
    expect(result.current.transform.k).toBeGreaterThan(1);
  });

  it('pans on pointer drag', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerDown({
        pointerId: 1, clientX: 100, clientY: 100, button: 0,
        currentTarget: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
      } as never);
    });
    act(() => {
      result.current.handlers.onPointerMove({ pointerId: 1, clientX: 80, clientY: 90 } as never);
    });

    expect(result.current.transform.x).toBe(-220);
    expect(result.current.transform.y).toBe(-110);
  });

  it('ignores pointer movement when no drag is in progress', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerMove({ pointerId: 1, clientX: 0, clientY: 0 } as never);
    });
    expect(result.current.transform.x).toBe(-200);
  });

  it('stops panning after pointer up', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerDown({
        pointerId: 1, clientX: 100, clientY: 100, button: 0,
        currentTarget: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
      } as never);
    });
    act(() => {
      result.current.handlers.onPointerUp({
        pointerId: 1,
        currentTarget: { releasePointerCapture: () => {} },
      } as never);
    });
    act(() => {
      result.current.handlers.onPointerMove({ pointerId: 1, clientX: 0, clientY: 0 } as never);
    });
    expect(result.current.transform.x).toBe(-200);
  });
});
```

- [x] **Step 7: Implement `src/hooks/useMapZoom.ts`**

```ts
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { deriveLevel, panBy, zoomAt } from '@/core/geo/index.js';
import type { GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { LEVEL_HYSTERESIS, LEVEL_THRESHOLD } from '@/data/geo/index.js';
import { useHeatMapDispatch, useHeatMapState } from './useHeatMapState.js';

/** One wheel notch. Multiplicative so zooming feels even at every scale. */
const WHEEL_STEP = 1.2;
const BUTTON_STEP = 1.5;

export interface MapZoomHandlers {
  onWheel(event: ReactWheelEvent<SVGSVGElement>): void;
  onPointerDown(event: ReactPointerEvent<SVGSVGElement>): void;
  onPointerMove(event: ReactPointerEvent<SVGSVGElement>): void;
  onPointerUp(event: ReactPointerEvent<SVGSVGElement>): void;
}

export interface MapZoom {
  transform: Transform;
  level: GeoLevel;
  handlers: MapZoomHandlers;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

/**
 * Owns pan, zoom, and the level that follows from the zoom scale.
 *
 * The drag origin lives in a ref, not state: a re-render per pointermove would
 * cost the 60 fps budget in §9, and nothing renders from it anyway.
 */
export function useMapZoom(viewport: Viewport): MapZoom {
  const transform = useHeatMapState((state) => state.transform);
  const level = useHeatMapState((state) => state.level);
  const dispatch = useHeatMapDispatch();

  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Level follows scale, and is written back so every panel reads one source of
  // truth. Hysteresis lives in deriveLevel, so this is safe to run every change.
  useEffect(() => {
    const next = deriveLevel(transform.k, level, LEVEL_THRESHOLD, LEVEL_HYSTERESIS);
    if (next !== level) dispatch({ type: 'setLevel', level: next });
  }, [transform.k, level, dispatch]);

  const applyZoom = useCallback((factor: number, point: readonly [number, number]) => {
    dispatch({
      type: 'setTransform',
      transform: zoomAt(transformRef.current, factor, point, viewport),
    });
  }, [dispatch, viewport]);

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    applyZoom(factor, [event.clientX - rect.left, event.clientY - rect.top]);
  }, [applyZoom]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dispatch({
      type: 'setTransform',
      transform: panBy(transformRef.current, dx, dy, viewport),
    });
  }, [dispatch, viewport]);

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const centre = (): [number, number] => [viewport.width / 2, viewport.height / 2];

  return {
    transform,
    level,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
    zoomIn: useCallback(() => { applyZoom(BUTTON_STEP, centre()); }, [applyZoom, viewport]),
    zoomOut: useCallback(() => { applyZoom(1 / BUTTON_STEP, centre()); }, [applyZoom, viewport]),
    reset: useCallback(() => { dispatch({ type: 'resetView' }); }, [dispatch]),
  };
}
```

- [x] **Step 8: Run the hook test to verify it passes**

Run: `npx vitest run src/hooks/useMapZoom.test.tsx`
Expected: PASS, 9 tests.

- [x] **Step 9: Commit**

```bash
git add src/core/geo/zoom.ts src/core/geo/zoom.test.ts src/core/geo/index.ts \
  src/hooks/useMapZoom.ts src/hooks/useMapZoom.test.tsx
git commit -m "feat(map): add pan, zoom and hysteresis-guarded level switching"
```

---

## Task 9: Projection wiring and the geometry hook

One place that turns a viewport plus a level into projected paths, cached bounds
and a cull set. Every layer reads from it, so the projection is built once per
size change rather than once per layer.

**Files:**
- Create: `src/hooks/useMapGeometry.ts`
- Test: `src/hooks/useMapGeometry.test.tsx`

**Interfaces:**
- Consumes: `createTurkeyProjection`, `createPathGenerator`, `collectBounds`, `cullFeatures` from `core/`; `getLevelFeatures` from Task 4.
- Produces:
  - `RenderFeature` — `{ code: string; name: string; d: string }`
  - `MapGeometry` — `{ features: readonly RenderFeature[]; visible: ReadonlySet<string>; bounds: ReadonlyMap<string, BBox>; ready: boolean }`
  - `useMapGeometry(viewport, level, transform): MapGeometry`

- [x] **Step 1: Write the failing test**

Create `src/hooks/useMapGeometry.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transform } from '@/core/types/index.js';
import { useMapGeometry } from './useMapGeometry.js';

const VIEWPORT = { width: 1000, height: 600 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

describe('useMapGeometry', () => {
  it('is not ready before the container has been measured', () => {
    const { result } = renderHook(
      () => useMapGeometry({ width: 0, height: 0 }, 'il', IDENTITY),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.features).toHaveLength(0);
  });

  it('projects all 81 provinces to non-empty path data', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.features).toHaveLength(81);
    for (const feature of result.current.features) {
      expect(feature.d.length).toBeGreaterThan(0);
      expect(feature.d.startsWith('M')).toBe(true);
    }
  });

  it('carries the Turkish region name with each path', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.features.find((f) => f.code === '34')?.name).toBe('İstanbul');
  });

  it('projects all 973 districts at ilçe level', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', IDENTITY));
    expect(result.current.features).toHaveLength(973);
  });

  it('considers every province visible at identity', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.visible.size).toBe(81);
  });

  it('culls districts outside the viewport when zoomed in', () => {
    const zoomed: Transform = { k: 8, x: -2000, y: -1200 };
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', zoomed));
    expect(result.current.visible.size).toBeLessThan(973);
    expect(result.current.visible.size).toBeGreaterThan(0);
  });

  it('reuses projected paths when only the transform changes', () => {
    const { result, rerender } = renderHook(
      ({ transform }: { transform: Transform }) => useMapGeometry(VIEWPORT, 'il', transform),
      { initialProps: { transform: IDENTITY } },
    );
    const before = result.current.features;

    rerender({ transform: { k: 3, x: -100, y: -50 } });
    // Panning must not re-project: the paths are drawn once and moved by the
    // group transform. Re-projecting here would re-run the blur on every drag.
    expect(result.current.features).toBe(before);
  });

  it('re-projects when the level changes', () => {
    const { result, rerender } = renderHook(
      ({ level }: { level: 'il' | 'ilce' }) => useMapGeometry(VIEWPORT, level, IDENTITY),
      { initialProps: { level: 'il' as const } },
    );
    const before = result.current.features;

    rerender({ level: 'ilce' as const });
    expect(result.current.features).not.toBe(before);
  });

  it('keeps every projected path inside the viewport box at identity', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    for (const [, bbox] of result.current.bounds) {
      const [[minX, minY], [maxX, maxY]] = bbox;
      expect(minX).toBeGreaterThanOrEqual(-1);
      expect(minY).toBeGreaterThanOrEqual(-1);
      expect(maxX).toBeLessThanOrEqual(VIEWPORT.width + 1);
      expect(maxY).toBeLessThanOrEqual(VIEWPORT.height + 1);
    }
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useMapGeometry.test.tsx`
Expected: FAIL — cannot resolve `./useMapGeometry.js`.

- [x] **Step 3: Implement `src/hooks/useMapGeometry.ts`**

```ts
import { useMemo } from 'react';
import {
  collectBounds, createPathGenerator, createTurkeyProjection, cullFeatures,
} from '@/core/geo/index.js';
import type { BBox, GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { getLevelFeatures, getLevelRegionMeta } from '@/data/geo/index.js';

export interface RenderFeature {
  code: string;
  name: string;
  /** SVG path data in projected pixel space, before the group transform. */
  d: string;
}

export interface MapGeometry {
  features: readonly RenderFeature[];
  /** Codes currently inside the viewport. */
  visible: ReadonlySet<string>;
  bounds: ReadonlyMap<string, BBox>;
  /** False until the container has a real size. */
  ready: boolean;
}

const EMPTY: MapGeometry = {
  features: [],
  visible: new Set(),
  bounds: new Map(),
  ready: false,
};

/**
 * Projects a level once per size change and culls per transform.
 *
 * The split matters. Paths are projected in *untransformed* pixel space and the
 * group's `transform` moves them, so panning and zooming never re-project and
 * never re-run the blur filter (§6.3). Only the cull set depends on the
 * transform, and it is a cheap rectangle test over cached bounds.
 */
export function useMapGeometry(
  viewport: Viewport,
  level: GeoLevel,
  transform: Transform,
): MapGeometry {
  const projected = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    const collection = getLevelFeatures(level);
    const projection = createTurkeyProjection({ viewport, fitTo: collection });
    const path = createPathGenerator(projection);
    const meta = getLevelRegionMeta(level);

    const features: RenderFeature[] = [];
    for (const feature of collection.features) {
      if (feature.id === undefined || feature.id === null) continue;

      const d = path(feature);
      // A polygon simplified below one pixel yields null path data. Skipping it
      // is correct — it has no visible area to paint or to hit-test.
      if (d === null || d === '') continue;

      const code = String(feature.id);
      features.push({ code, name: meta.get(code)?.name ?? code, d });
    }

    return { features, bounds: collectBounds(path, collection) };
  }, [viewport, level]);

  const visible = useMemo(() => {
    if (projected === null) return EMPTY.visible;
    return cullFeatures(projected.bounds, transform, viewport);
  }, [projected, transform, viewport]);

  return useMemo(() => (
    projected === null
      ? EMPTY
      : { features: projected.features, bounds: projected.bounds, visible, ready: true }
  ), [projected, visible]);
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useMapGeometry.test.tsx`
Expected: PASS, 9 tests.

The "reuses projected paths" test is the performance contract for the whole
phase. If it fails, `viewport` or `level` is a fresh object each render.

- [x] **Step 5: Commit**

```bash
git add src/hooks/useMapGeometry.ts src/hooks/useMapGeometry.test.tsx
git commit -m "feat(map): project geometry once per size and cull per transform"
```

---

## Task 10: MapDefs and HeatLayer

The blurred fills that produce the diffused look from the reference image. The
blur is the single most expensive thing the component does, so it is scoped
tightly: one filter, applied to one group, re-rendered only when data changes.

**Files:**
- Create: `src/components/MapCanvas/MapDefs.tsx`
- Create: `src/components/MapCanvas/HeatLayer.tsx`
- Create: `src/components/MapCanvas/MapCanvas.module.css`
- Test: `src/components/MapCanvas/HeatLayer.test.tsx`

**Interfaces:**
- Consumes: `RenderFeature` from Task 9; `ColorScale` from `core/color`.
- Produces:
  - `MapDefs` — `(props: { idPrefix: string; blurStdDeviation: number; outlinePath: string }) => JSX.Element`
  - `HeatLayer` — `(props: { features; values; scale; idPrefix; heatStyle; visible? }) => JSX.Element`
  - `HeatStyle = 'glow' | 'flat'`

- [x] **Step 1: Write the failing test**

Create `src/components/MapCanvas/HeatLayer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createColorScale } from '@/core/color/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { HeatLayer } from './HeatLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
  { code: '35', name: 'İzmir', d: 'M40,0L50,0L50,10Z' },
];

const VALUES = new Map([['34', 100], ['06', 40]]);
const SCALE = createColorScale({ values: [100, 40], mode: 'quantile', ramp: 'spectral' });

function renderLayer(props: Partial<Parameters<typeof HeatLayer>[0]> = {}) {
  return render(
    <svg>
      <HeatLayer
        features={FEATURES}
        values={VALUES}
        scale={SCALE}
        idPrefix="t"
        heatStyle="glow"
        {...props}
      />
    </svg>,
  );
}

describe('HeatLayer', () => {
  it('draws one path per feature', () => {
    const { container } = renderLayer();
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });

  it('fills each region from the colour scale', () => {
    const { container } = renderLayer();
    const istanbul = container.querySelector('path[data-code="34"]');
    expect(istanbul?.getAttribute('fill')).toBe(SCALE(100));
  });

  it('renders a region with no data in the no-data fill, not in a scale colour', () => {
    const { container } = renderLayer();
    const izmir = container.querySelector('path[data-code="35"]');
    expect(izmir?.getAttribute('fill')).toBe('var(--hm-no-data)');
  });

  it('applies the blur filter in glow mode', () => {
    const { container } = renderLayer();
    expect(container.querySelector('g')?.getAttribute('filter')).toBe('url(#t-blur)');
  });

  it('applies no filter in flat mode, which is the documented escape hatch', () => {
    const { container } = renderLayer({ heatStyle: 'flat' });
    expect(container.querySelector('g')?.getAttribute('filter')).toBeNull();
  });

  it('is hidden from assistive technology, since HitLayer carries the semantics', () => {
    const { container } = renderLayer();
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders only visible features when a cull set is supplied', () => {
    const { container } = renderLayer({ visible: new Set(['34']) });
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('renders everything when no cull set is supplied', () => {
    const { container } = renderLayer({ visible: undefined });
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/MapCanvas/HeatLayer.test.tsx`
Expected: FAIL — cannot resolve `./HeatLayer.js`.

- [x] **Step 3: Add the no-data token**

Append to `src/styles/tokens.css` inside `:root`, and add `--hm-no-data` to
`THEME_TOKEN_NAMES` in `src/styles/index.ts` — the token test in Task 2 fails
otherwise, by design.

```css
  --hm-no-data: rgba(255, 255, 255, 0.06);
```

- [x] **Step 4: Implement `MapDefs`**

```tsx
export interface MapDefsProps {
  /** Namespaces filter and clip ids so two mounted maps never collide. */
  idPrefix: string;
  blurStdDeviation: number;
  /** Union outline of the country, used to clip the bleed at the coastline. */
  outlinePath: string;
}

/**
 * SVG defs for the heat rendering.
 *
 * ids are prefixed because SVG ids are document-global: two `<CrimeHeatMap>`
 * instances on one page would otherwise share a filter, and the second would
 * silently take the first's blur radius.
 */
export function MapDefs({ idPrefix, blurStdDeviation, outlinePath }: MapDefsProps) {
  return (
    <defs>
      <filter
        id={`${idPrefix}-blur`}
        // The default filter region clips the bleed at the bounding box; widen
        // it so colour can spread past a region's own edge.
        x="-20%" y="-20%" width="140%" height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation={blurStdDeviation} />
      </filter>
      <clipPath id={`${idPrefix}-outline`}>
        <path d={outlinePath} />
      </clipPath>
    </defs>
  );
}
```

- [x] **Step 5: Implement `HeatLayer`**

```tsx
import type { ColorScale } from '@/core/color/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export type HeatStyle = 'glow' | 'flat';

export interface HeatLayerProps {
  features: readonly RenderFeature[];
  /** Region code → value for the active filters. Missing means no data. */
  values: ReadonlyMap<string, number>;
  scale: ColorScale;
  idPrefix: string;
  heatStyle: HeatStyle;
  /** Codes to draw. Omit to draw everything. */
  visible?: ReadonlySet<string>;
}

/**
 * The blurred fills.
 *
 * A region with no data is painted in the neutral no-data fill rather than the
 * scale's zero colour: "no records" and "zero crimes" are different claims, and
 * colouring them identically would assert the stronger one.
 */
export function HeatLayer({
  features, values, scale, idPrefix, heatStyle, visible,
}: HeatLayerProps) {
  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  return (
    <g
      // Pointer events and semantics belong to HitLayer, which is unblurred and
      // therefore pixel-accurate against the true boundaries.
      aria-hidden="true"
      clipPath={`url(#${idPrefix}-outline)`}
      {...(heatStyle === 'glow' ? { filter: `url(#${idPrefix}-blur)` } : {})}
    >
      {drawn.map((feature) => {
        const value = values.get(feature.code);
        return (
          <path
            key={feature.code}
            data-code={feature.code}
            d={feature.d}
            fill={value === undefined ? 'var(--hm-no-data)' : scale(value)}
          />
        );
      })}
    </g>
  );
}
```

- [x] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/MapCanvas/HeatLayer.test.tsx`
Expected: PASS, 8 tests.

- [x] **Step 7: Commit**

```bash
git add src/components/MapCanvas src/styles
git commit -m "feat(map): add blur defs and heat fill layer"
```

---

## Task 11: BorderLayer

Hairline borders that stay hairline at any zoom, drawn above the blur so the
diffused colour never washes out the boundaries.

**Files:**
- Create: `src/components/MapCanvas/BorderLayer.tsx`
- Test: `src/components/MapCanvas/BorderLayer.test.tsx`

**Interfaces:**
- Consumes: `RenderFeature`.
- Produces: `BorderLayer` — `(props: { features; visible? }) => JSX.Element`

- [x] **Step 1: Write the failing test**

Create `src/components/MapCanvas/BorderLayer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { BorderLayer } from './BorderLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];

describe('BorderLayer', () => {
  it('draws one stroked path per feature', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('never fills, so it cannot hide the heat beneath it', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelector('g')?.getAttribute('fill')).toBe('none');
  });

  it('keeps strokes hairline at any zoom via non-scaling-stroke', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    const path = container.querySelector('path');
    expect(path?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<svg><BorderLayer features={FEATURES} /></svg>);
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('honours the cull set', () => {
    const { container } = render(
      <svg><BorderLayer features={FEATURES} visible={new Set(['06'])} /></svg>,
    );
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('path')?.getAttribute('data-code')).toBe('06');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/MapCanvas/BorderLayer.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `BorderLayer`**

```tsx
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface BorderLayerProps {
  features: readonly RenderFeature[];
  visible?: ReadonlySet<string>;
}

/**
 * Crisp region outlines.
 *
 * `vector-effect: non-scaling-stroke` keeps the stroke one pixel wide however
 * far the parent group is scaled. Without it a 0.75px border becomes 9px at
 * k=12 and the map turns into a mesh of white lines.
 */
export function BorderLayer({ features, visible }: BorderLayerProps) {
  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  return (
    <g
      aria-hidden="true"
      fill="none"
      stroke="var(--hm-border-stroke)"
      strokeWidth="var(--hm-border-width)"
      strokeLinejoin="round"
    >
      {drawn.map((feature) => (
        <path
          key={feature.code}
          data-code={feature.code}
          d={feature.d}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/MapCanvas/BorderLayer.test.tsx`
Expected: PASS, 5 tests.

- [x] **Step 5: Commit**

```bash
git add src/components/MapCanvas/BorderLayer.tsx src/components/MapCanvas/BorderLayer.test.tsx
git commit -m "feat(map): add non-scaling border layer"
```

---

## Task 12: HitLayer — pointer targets, keyboard navigation, and semantics

The transparent layer that carries every interaction. Hover is pixel-accurate
against true boundaries here even though the visible colour is blurred across
them, and this is where the map becomes keyboard-operable and screen-reader
legible (§10).

**Files:**
- Create: `src/components/MapCanvas/HitLayer.tsx`
- Test: `src/components/MapCanvas/HitLayer.test.tsx`

**Interfaces:**
- Consumes: `RenderFeature`; `useSetHoverTarget` from Task 5; `useStrings`.
- Produces: `HitLayer` — `(props: { features; values; names; visible?; selectedCode; focusedCode; onSelect; onFocusRegion; formatValue }) => JSX.Element`

- [x] **Step 1: Write the failing test**

Create `src/components/MapCanvas/HitLayer.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { HitLayer } from './HitLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];
const VALUES = new Map([['34', 1234], ['06', 40]]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderLayer(props: Partial<Parameters<typeof HitLayer>[0]> = {}) {
  const hoverStore = createHoverStore();
  const store = createHeatMapStore(base);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      <svg>{children}</svg>
    </HeatMapProvider>
  );
  const utils = render(
    <HitLayer
      features={FEATURES}
      values={VALUES}
      selectedCode={null}
      focusedCode={null}
      onSelect={() => {}}
      onFocusRegion={() => {}}
      formatValue={(v) => String(v)}
      {...props}
    />,
    { wrapper },
  );
  return { ...utils, hoverStore, store };
}

describe('HitLayer', () => {
  it('renders a transparent path per feature', () => {
    const { container } = renderLayer();
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('transparent');
  });

  it('labels each region with its name and value for screen readers', () => {
    renderLayer();
    expect(screen.getByRole('img', { name: /İstanbul/u }).getAttribute('aria-label'))
      .toContain('1234');
  });

  it('says "no data" for a region absent from the values map', () => {
    renderLayer({ values: new Map() });
    expect(screen.getByRole('img', { name: /İstanbul/u }).getAttribute('aria-label'))
      .toContain(trStrings.tooltip.noData);
  });

  it('publishes a hover target on pointer enter', () => {
    const { container, hoverStore } = renderLayer();
    const path = container.querySelector('path[data-code="34"]')!;
    fireEvent.pointerEnter(path, { clientX: 12, clientY: 34 });
    expect(hoverStore.getState()).toEqual({ code: '34', x: 12, y: 34 });
  });

  it('clears the hover target on pointer leave', () => {
    const { container, hoverStore } = renderLayer();
    const path = container.querySelector('path[data-code="34"]')!;
    fireEvent.pointerEnter(path, { clientX: 1, clientY: 2 });
    fireEvent.pointerLeave(path);
    expect(hoverStore.getState()).toBeNull();
  });

  it('selects a region on click', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect });
    fireEvent.click(container.querySelector('path[data-code="06"]')!);
    expect(onSelect).toHaveBeenCalledWith('06');
  });

  it('selects on Enter, so the map is operable without a pointer', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('06');
  });

  it('clears the selection on Escape', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect, selectedCode: '06' });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('moves focus to the next region on ArrowRight', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '34' });
    fireEvent.keyDown(container.querySelector('path[data-code="34"]')!, { key: 'ArrowRight' });
    expect(onFocusRegion).toHaveBeenCalledWith('06');
  });

  it('moves focus to the previous region on ArrowLeft', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '06' });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'ArrowLeft' });
    expect(onFocusRegion).toHaveBeenCalledWith('34');
  });

  it('stops at the ends rather than wrapping, so arrowing has a felt boundary', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '34' });
    fireEvent.keyDown(container.querySelector('path[data-code="34"]')!, { key: 'ArrowLeft' });
    expect(onFocusRegion).not.toHaveBeenCalled();
  });

  it('puts exactly one region in the tab order', () => {
    const { container } = renderLayer({ focusedCode: '06' });
    const tabbable = [...container.querySelectorAll('path')]
      .filter((p) => p.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute('data-code')).toBe('06');
  });

  it('makes the first region tabbable when nothing is focused yet', () => {
    const { container } = renderLayer({ focusedCode: null });
    expect(container.querySelector('path[data-code="34"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('honours the cull set', () => {
    const { container } = renderLayer({ visible: new Set(['34']) });
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/MapCanvas/HitLayer.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `HitLayer`**

```tsx
import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface HitLayerProps {
  features: readonly RenderFeature[];
  values: ReadonlyMap<string, number>;
  visible?: ReadonlySet<string>;
  selectedCode: string | null;
  focusedCode: string | null;
  onSelect(code: string | null): void;
  onFocusRegion(code: string): void;
  formatValue(value: number): string;
}

/**
 * Transparent interaction surface.
 *
 * Separate from the visible fills for two reasons. The heat layer is blurred,
 * so hit-testing it would be inaccurate by exactly the blur radius; and the
 * fills are re-coloured on every filter change, while this layer's DOM is
 * stable. Every region is a focusable `role="img"` with a name-and-value label,
 * which is what makes the map usable without sight or a pointer (§10).
 */
export function HitLayer({
  features, values, visible, selectedCode, focusedCode,
  onSelect, onFocusRegion, formatValue,
}: HitLayerProps) {
  const setHover = useSetHoverTarget();
  const strings = useStrings();

  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  // Exactly one region carries tabindex=0 so the map is a single tab stop;
  // arrow keys move within it. A tab stop per region would mean 973 of them.
  const tabbableCode = focusedCode ?? drawn[0]?.code ?? null;

  const onKeyDown = useCallback((event: ReactKeyboardEvent<SVGPathElement>, code: string) => {
    const index = drawn.findIndex((feature) => feature.code === code);

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(code);
        return;
      case 'Escape':
        event.preventDefault();
        onSelect(null);
        return;
      case 'ArrowRight':
      case 'ArrowDown': {
        const next = drawn[index + 1];
        if (next !== undefined) { event.preventDefault(); onFocusRegion(next.code); }
        return;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        const prev = drawn[index - 1];
        if (prev !== undefined) { event.preventDefault(); onFocusRegion(prev.code); }
        return;
      }
      default:
    }
  }, [drawn, onSelect, onFocusRegion]);

  const onPointerEnter = useCallback((
    event: ReactPointerEvent<SVGPathElement>,
    code: string,
  ) => {
    setHover({ type: 'enter', target: { code, x: event.clientX, y: event.clientY } });
  }, [setHover]);

  return (
    <g>
      {drawn.map((feature) => {
        const value = values.get(feature.code);
        const label = `${feature.name}: ${
          value === undefined ? strings.tooltip.noData : formatValue(value)
        }`;

        return (
          <path
            key={feature.code}
            data-code={feature.code}
            d={feature.d}
            fill="transparent"
            role="img"
            aria-label={label}
            tabIndex={feature.code === tabbableCode ? 0 : -1}
            {...(feature.code === selectedCode ? { 'aria-current': 'true' as const } : {})}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerEnter={(event) => { onPointerEnter(event, feature.code); }}
            onPointerMove={(event) => {
              setHover({ type: 'move', x: event.clientX, y: event.clientY });
            }}
            onPointerLeave={() => { setHover({ type: 'leave' }); }}
            onClick={() => { onSelect(feature.code); }}
            onFocus={() => { onFocusRegion(feature.code); }}
            onKeyDown={(event) => { onKeyDown(event, feature.code); }}
          />
        );
      })}
    </g>
  );
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/MapCanvas/HitLayer.test.tsx`
Expected: PASS, 14 tests.

- [x] **Step 5: Commit**

```bash
git add src/components/MapCanvas/HitLayer.tsx src/components/MapCanvas/HitLayer.test.tsx
git commit -m "feat(map): add hit layer with keyboard navigation and aria labels"
```

---

## Task 13: SelectionLayer and MapCanvas assembly

Stacks the four layers into one `<svg>` with a single transform group, and draws
the selection and hover highlights above everything.

**Files:**
- Create: `src/components/MapCanvas/SelectionLayer.tsx`
- Create: `src/components/MapCanvas/MapCanvas.tsx`
- Create: `src/components/MapCanvas/index.ts`
- Test: `src/components/MapCanvas/SelectionLayer.test.tsx`
- Test: `src/components/MapCanvas/MapCanvas.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 8–12.
- Produces:
  - `SelectionLayer` — `(props: { features; selectedCode; hoveredCode; focusedCode }) => JSX.Element`
  - `MapCanvas` — `(props: { data; categories; colorScale; heatStyle; onRegionClick? }) => JSX.Element`

- [x] **Step 1: Write the failing SelectionLayer test**

Create `src/components/MapCanvas/SelectionLayer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { SelectionLayer } from './SelectionLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];

function renderLayer(props: Partial<Parameters<typeof SelectionLayer>[0]> = {}) {
  return render(
    <svg>
      <SelectionLayer
        features={FEATURES}
        selectedCode={null}
        hoveredCode={null}
        focusedCode={null}
        {...props}
      />
    </svg>,
  );
}

describe('SelectionLayer', () => {
  it('draws nothing when nothing is selected, hovered or focused', () => {
    const { container } = renderLayer();
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  it('outlines the hovered region', () => {
    const { container } = renderLayer({ hoveredCode: '34' });
    expect(container.querySelector('path[data-role="hover"]')).not.toBeNull();
  });

  it('outlines the selected region', () => {
    const { container } = renderLayer({ selectedCode: '06' });
    expect(container.querySelector('path[data-role="selected"]')).not.toBeNull();
  });

  it('draws a visible focus ring, which must survive the glass backdrop', () => {
    const { container } = renderLayer({ focusedCode: '34' });
    const ring = container.querySelector('path[data-role="focus"]');
    expect(ring?.getAttribute('stroke')).toBe('var(--hm-focus-ring)');
  });

  it('can show selection and hover on different regions at once', () => {
    const { container } = renderLayer({ selectedCode: '34', hoveredCode: '06' });
    expect(container.querySelector('path[data-role="selected"]')?.getAttribute('data-code'))
      .toBe('34');
    expect(container.querySelector('path[data-role="hover"]')?.getAttribute('data-code'))
      .toBe('06');
  });

  it('ignores a code with no matching feature', () => {
    const { container } = renderLayer({ selectedCode: 'yok' });
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });

  it('is hidden from assistive technology, since HitLayer already announces state', () => {
    const { container } = renderLayer({ selectedCode: '34' });
    expect(container.querySelector('g')?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/MapCanvas/SelectionLayer.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `SelectionLayer`**

```tsx
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface SelectionLayerProps {
  features: readonly RenderFeature[];
  selectedCode: string | null;
  hoveredCode: string | null;
  focusedCode: string | null;
}

interface HighlightProps {
  feature: RenderFeature | undefined;
  role: 'hover' | 'selected' | 'focus';
  stroke: string;
  width: number;
  dashed?: boolean;
}

function Highlight({ feature, role, stroke, width, dashed }: HighlightProps) {
  if (feature === undefined) return null;
  return (
    <path
      data-role={role}
      data-code={feature.code}
      d={feature.d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      vectorEffect="non-scaling-stroke"
      {...(dashed === true ? { strokeDasharray: '4 3' } : {})}
    />
  );
}

/**
 * Highlights, drawn above every other layer.
 *
 * Kept separate from BorderLayer because it re-renders on pointer movement
 * while the borders do not — and because a highlight must never be blurred or
 * clipped by the country outline the way the heat fills are.
 */
export function SelectionLayer({
  features, selectedCode, hoveredCode, focusedCode,
}: SelectionLayerProps) {
  const find = (code: string | null): RenderFeature | undefined =>
    code === null ? undefined : features.find((feature) => feature.code === code);

  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <Highlight feature={find(hoveredCode)} role="hover" stroke="var(--hm-fg)" width={1.5} />
      <Highlight feature={find(selectedCode)} role="selected" stroke="var(--hm-fg)" width={2.5} />
      <Highlight
        feature={find(focusedCode)}
        role="focus"
        stroke="var(--hm-focus-ring)"
        width={3}
        dashed
      />
    </g>
  );
}
```

- [x] **Step 4: Write the failing MapCanvas test**

Create `src/components/MapCanvas/MapCanvas.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { MapCanvas } from './MapCanvas.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', category: 'hirsizlik', count: 40 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2020], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderCanvas(state: HeatMapState = base, props = {}) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  // jsdom reports every element as 0x0, so the ResizeObserver-driven viewport
  // never arrives. Pass an explicit size to exercise the rendering path.
  const utils = render(
    <MapCanvas
      data={DATA}
      categories={CATEGORIES}
      colorScale="spectral"
      heatStyle="glow"
      testViewport={{ width: 800, height: 500 }}
      {...props}
    />,
    { wrapper },
  );
  return { ...utils, store };
}

describe('MapCanvas', () => {
  it('renders an accessible svg', () => {
    renderCanvas();
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('draws all four layers', () => {
    const { container } = renderCanvas();
    expect(container.querySelector('svg > defs')).not.toBeNull();
    // heat, border, hit, selection
    expect(container.querySelectorAll('svg > g > g').length).toBeGreaterThanOrEqual(4);
  });

  it('puts pan and zoom on a single transform group', () => {
    const { container } = renderCanvas({ ...base, transform: { k: 3, x: -100, y: -50 } });
    const group = container.querySelector('svg > g');
    expect(group?.getAttribute('transform')).toBe('translate(-100,-50) scale(3)');
  });

  it('renders 81 hit targets at il level', () => {
    const { container } = renderCanvas();
    expect(container.querySelectorAll('path[role="img"]')).toHaveLength(81);
  });

  it('scales the blur down as zoom rises, so softness looks constant', () => {
    const { container: a } = renderCanvas();
    const { container: b } = renderCanvas({ ...base, transform: { k: 4, x: 0, y: 0 } });
    const read = (c: HTMLElement) =>
      Number(c.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'));
    expect(read(b)).toBeLessThan(read(a));
  });

  it('reports a region click to the consumer', () => {
    const onRegionClick = vi.fn();
    const { container } = renderCanvas(base, { onRegionClick });
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(onRegionClick).toHaveBeenCalledWith(
      expect.objectContaining({ code: '34', name: 'İstanbul' }),
    );
  });

  it('announces the loading state before the container is measured', () => {
    renderCanvas(base, { testViewport: { width: 0, height: 0 } });
    expect(screen.getByText(trStrings.map.loading)).toBeInTheDocument();
  });

  it('gives each instance its own filter ids so two maps cannot collide', () => {
    const { container: a } = renderCanvas();
    const { container: b } = renderCanvas();
    const idOf = (c: HTMLElement) => c.querySelector('filter')?.getAttribute('id');
    expect(idOf(a)).not.toBe(idOf(b));
  });
});
```

- [x] **Step 5: Implement `MapCanvas`**

```tsx
import { useCallback, useId, useMemo } from 'react';
import { formatTrNumber } from '@/core/format/index.js';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import type { CrimeCategory, CrimeRecord, Viewport } from '@/core/types/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget } from '@/hooks/useHoverTarget.js';
import { useMapGeometry } from '@/hooks/useMapGeometry.js';
import { useMapZoom } from '@/hooks/useMapZoom.js';
import { useResizeObserver } from '@/hooks/useResizeObserver.js';
import { BorderLayer } from './BorderLayer.js';
import { HeatLayer, type HeatStyle } from './HeatLayer.js';
import { HitLayer } from './HitLayer.js';
import { MapDefs } from './MapDefs.js';
import { SelectionLayer } from './SelectionLayer.js';
import styles from './MapCanvas.module.css';

/** Blur radius at k=1, in projected pixels. */
const BASE_BLUR = 12;

export interface RegionClickPayload {
  code: string;
  name: string;
  value: number | null;
}

export interface MapCanvasProps {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  colorScale: ColorScaleName | RampFn;
  heatStyle: HeatStyle;
  onRegionClick?(region: RegionClickPayload): void;
  /** Test-only size override; jsdom reports every element as 0x0. */
  testViewport?: Viewport;
}

export function MapCanvas({
  data, categories, colorScale, heatStyle, onRegionClick, testViewport,
}: MapCanvasProps) {
  const [containerRef, measured] = useResizeObserver<HTMLDivElement>();
  const viewport = testViewport ?? measured;

  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const idPrefix = useId().replace(/:/gu, '');

  const { transform, level, handlers } = useMapZoom(viewport);
  const geometry = useMapGeometry(viewport, level, transform);
  const { rollup, scale, names } = useAggregates({ data, categories, colorScale });

  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const focusedCode = useHeatMapState((state) => state.focusedCode);
  const hover = useHoverTarget();

  const values = useMemo(() => {
    const out = new Map<string, number>();
    for (const [code, aggregate] of rollup.byRegion) out.set(code, aggregate.total);
    return out;
  }, [rollup]);

  // The union of every region is the clip for the heat bleed. Concatenating the
  // path data is enough — SVG treats it as one shape with the default fill rule.
  const outlinePath = useMemo(
    () => geometry.features.map((feature) => feature.d).join(' '),
    [geometry.features],
  );

  const onSelect = useCallback((code: string | null) => {
    dispatch({ type: 'select', code });
    if (code === null || onRegionClick === undefined) return;
    onRegionClick({
      code,
      name: names.get(code) ?? code,
      value: values.get(code) ?? null,
    });
  }, [dispatch, onRegionClick, names, values]);

  const onFocusRegion = useCallback((code: string) => {
    dispatch({ type: 'focus', code });
  }, [dispatch]);

  return (
    <div ref={containerRef} className={styles.container}>
      {!geometry.ready ? (
        <p className={styles.loading}>{strings.map.loading}</p>
      ) : (
        <svg
          className={styles.svg}
          role="application"
          aria-label={strings.map.label}
          width={viewport.width}
          height={viewport.height}
          {...handlers}
        >
          <MapDefs
            idPrefix={idPrefix}
            // Perceived softness must stay constant across zoom, so the radius
            // shrinks as the group scales up (§6.3).
            blurStdDeviation={BASE_BLUR / transform.k}
            outlinePath={outlinePath}
          />
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <HeatLayer
              features={geometry.features}
              values={values}
              scale={scale}
              idPrefix={idPrefix}
              heatStyle={heatStyle}
              visible={geometry.visible}
            />
            <BorderLayer features={geometry.features} visible={geometry.visible} />
            <HitLayer
              features={geometry.features}
              values={values}
              visible={geometry.visible}
              selectedCode={selectedCode}
              focusedCode={focusedCode}
              onSelect={onSelect}
              onFocusRegion={onFocusRegion}
              formatValue={formatTrNumber}
            />
            <SelectionLayer
              features={geometry.features}
              selectedCode={selectedCode}
              hoveredCode={hover?.code ?? null}
              focusedCode={focusedCode}
            />
          </g>
        </svg>
      )}
    </div>
  );
}
```

- [x] **Step 6: Add `MapCanvas.module.css`**

```css
.container {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.svg:active {
  cursor: grabbing;
}

.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--hm-fg-muted);
}
```

- [x] **Step 7: Write the barrel `src/components/MapCanvas/index.ts`**

```ts
export type { HeatStyle } from './HeatLayer.js';
export type { MapCanvasProps, RegionClickPayload } from './MapCanvas.js';
export { MapCanvas } from './MapCanvas.js';
```

- [x] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/components/MapCanvas`
Expected: PASS — 7 SelectionLayer tests, 8 MapCanvas tests, plus the earlier
layer tests.

- [x] **Step 9: See it in the playground**

Replace `playground/main.tsx` so it mounts the real map with mock data:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HeatMapProvider } from '../src/context/HeatMapProvider.js';
import { createHeatMapStore } from '../src/context/HeatMapStore.js';
import { createHoverStore } from '../src/context/HoverStore.js';
import { MapCanvas } from '../src/components/MapCanvas/index.js';
import { MOCK_CATEGORIES, generateMockData } from '../src/data/mock/index.js';
import { trStrings } from '../src/i18n/index.js';
import '../src/styles/index.js';

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const dataset = generateMockData({ seed: 42, years: YEARS, includeIlce: true });
const store = createHeatMapStore({
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
});

const root = document.getElementById('root');
if (root === null) throw new Error('#root yok');

createRoot(root).render(
  <StrictMode>
    <div className="hm-root">
      <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
        <MapCanvas
          data={dataset.records}
          categories={dataset.categories}
          colorScale="spectral"
          heatStyle="glow"
        />
      </HeatMapProvider>
    </div>
  </StrictMode>,
);
```

`generateMockData` returns its own `categories`, so `MOCK_CATEGORIES` is not
needed here — drop that import if your editor flags it as unused.

**Expect the district layer to be partly grey.** The mock generator already
emits `{plaka}{NN}` codes, the same scheme the shipped geography uses, so
low-numbered districts line up. But it picks its district count from a
population weight rather than from the real geography, so a province with more
real districts than mock ones shows a no-data tail, and one with fewer shows
mock records for codes that no longer exist. Provinces are fully covered and are
what to judge by here; Task 18 makes the district layer consistent too.

Run `npm run playground` and confirm, by eye:

- Türkiye is recognisable and fills the frame
- colours vary across provinces rather than being one flat wash
- the wheel zooms toward the cursor, and dragging pans
- past roughly 2.65× the map switches to districts and gets denser
- borders stay hairline at maximum zoom
- clicking a region draws a selection outline

This is the first point where the phase is visually verifiable. Do not move on
if the map does not look like Türkiye.

- [x] **Step 10: Run the full verification and commit**

```bash
npm run typecheck && npm run lint && npx vitest run
```

```bash
git add src/components/MapCanvas playground/main.tsx
git commit -m "feat(map): assemble MapCanvas from heat, border, hit and selection layers"
```

---

**Part 2 ends here.** Tasks 14–19 (legend, tooltip, fly-to, attribution, root
component, exit verification) are in
`docs/superpowers/plans/2026-08-01-phase-2-map-part-3.md`.
