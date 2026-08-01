# Türkiye Suç Haritası — Phase 2: Map (Part 3 — Chrome and integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Continues `docs/superpowers/plans/2026-08-01-phase-2-map-part-2.md`. The Global
Constraints in `2026-08-01-phase-2-map.md` apply to every task here. Tasks 1–13
are complete before starting Task 14.

---

## Task 14: Legend

The legend is the only thing that tells a reader whether the colours mean rank
or magnitude, so it always states the active scale mode (§6.5).

**Files:**
- Create: `src/components/Legend/Legend.tsx`
- Create: `src/components/Legend/Legend.module.css`
- Create: `src/components/Legend/index.ts`
- Test: `src/components/Legend/Legend.test.tsx`

**Interfaces:**
- Consumes: `computeLegendBreaks`, `ColorScale` from `core/color`; `useStrings`, `useHeatMapState`.
- Produces: `Legend` — `(props: { scale: ColorScale; breakCount?: number }) => JSX.Element`

- [x] **Step 1: Write the failing test**

Create `src/components/Legend/Legend.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createColorScale } from '@/core/color/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { Legend } from './Legend.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

const SCALE = createColorScale({
  values: [10, 40, 90, 250, 900],
  mode: 'quantile',
  ramp: 'spectral',
});

function renderLegend(scale = SCALE, state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return render(<Legend scale={scale} />, { wrapper });
}

describe('Legend', () => {
  it('is labelled as a group', () => {
    renderLegend();
    expect(screen.getByRole('group', { name: trStrings.legend.title })).toBeInTheDocument();
  });

  it('renders one swatch per break', () => {
    const { container } = renderLegend();
    expect(container.querySelectorAll('[data-role="swatch"]').length).toBeGreaterThan(1);
  });

  it('shows a number beside every colour, because colour alone is not accessible', () => {
    const { container } = renderLegend();
    const swatches = container.querySelectorAll('[data-role="swatch"]');
    for (const swatch of swatches) {
      expect(swatch.textContent?.trim()).not.toBe('');
    }
  });

  it('names the active scale mode, so rank is never read as magnitude', () => {
    renderLegend();
    expect(screen.getByText(new RegExp(trStrings.scaleMode.quantile, 'u'))).toBeInTheDocument();
  });

  it('names the linear mode when that is active', () => {
    const linear = createColorScale({ values: [1, 2, 3], mode: 'linear', ramp: 'spectral' });
    renderLegend(linear, { ...base, scaleMode: 'linear' });
    expect(screen.getByText(new RegExp(trStrings.scaleMode.linear, 'u'))).toBeInTheDocument();
  });

  it('says "no data" for an empty domain rather than rendering an empty ramp', () => {
    const empty = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    renderLegend(empty);
    expect(screen.getByText(trStrings.legend.noData)).toBeInTheDocument();
  });

  it('collapses to a single swatch when every value is identical', () => {
    const flat = createColorScale({ values: [5, 5, 5], mode: 'quantile', ramp: 'spectral' });
    const { container } = renderLegend(flat);
    expect(container.querySelectorAll('[data-role="swatch"]')).toHaveLength(1);
  });

  it('paints each swatch with its break colour', () => {
    const { container } = renderLegend();
    const first = container.querySelector('[data-role="swatch"] [data-role="chip"]');
    expect(first?.getAttribute('style')).toMatch(/background/u);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Legend/Legend.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `Legend`**

```tsx
import { useMemo } from 'react';
import { computeLegendBreaks, type ColorScale } from '@/core/color/index.js';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './Legend.module.css';

const DEFAULT_BREAKS = 6;

export interface LegendProps {
  scale: ColorScale;
  breakCount?: number;
}

/**
 * The colour key.
 *
 * Always states the active scale mode, because a quantile map answers "how does
 * this rank" while a linear map answers "how many", and reading one as the
 * other is a real analytical error (§6.5). Numbers sit beside every swatch for
 * the same reason: no rainbow ramp is fully colourblind-safe, so colour is the
 * summary and the number is the source of truth.
 */
export function Legend({ scale, breakCount = DEFAULT_BREAKS }: LegendProps) {
  const strings = useStrings();
  const scaleMode = useHeatMapState((state) => state.scaleMode);

  const breaks = useMemo(
    () => computeLegendBreaks(scale, breakCount),
    [scale, breakCount],
  );

  const hasData = scale.domain.max > 0 || scale.domain.min !== scale.domain.max;

  return (
    <GlassPanel label={strings.legend.title} className={styles.legend}>
      <h2 className={styles.title}>{strings.legend.title}</h2>

      {!hasData ? (
        <p className={styles.empty}>{strings.legend.noData}</p>
      ) : (
        <ul className={styles.list}>
          {breaks.map((entry) => (
            <li key={`${entry.from}-${entry.to}`} className={styles.item} data-role="swatch">
              <span
                className={styles.chip}
                data-role="chip"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span className={styles.label}>{entry.label}</span>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.note}>
        {strings.scaleMode[scaleMode]} · {strings.legend.scaleNote}
      </p>
    </GlassPanel>
  );
}
```

- [x] **Step 4: Add `Legend.module.css`**

```css
.legend {
  padding: 10px 12px;
  min-width: 150px;
}

.title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--hm-fg);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 3px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--hm-fg);
}

.chip {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.label {
  font-variant-numeric: tabular-nums;
}

.empty,
.note {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--hm-fg-muted);
}
```

- [x] **Step 5: Write the barrel and run the test**

`src/components/Legend/index.ts`:

```ts
export type { LegendProps } from './Legend.js';
export { Legend } from './Legend.js';
```

Run: `npx vitest run src/components/Legend/Legend.test.tsx`
Expected: PASS, 8 tests.

If the "no data" test fails, check what `createColorDomain` returns for an empty
value list and adjust the `hasData` condition to match — do not change `core/`.

- [x] **Step 6: Commit**

```bash
git add src/components/Legend
git commit -m "feat(legend): add colour key stating the active scale mode"
```

---

## Task 15: HoverTooltip

Follows the cursor, flips near the viewport edges so it is never clipped, and
appears after a short delay so fast traversal does not flicker (§7.2).

**Files:**
- Create: `src/core/geo/tooltipPlacement.ts`
- Create: `src/components/HoverTooltip/HoverTooltip.tsx`
- Create: `src/components/HoverTooltip/HoverTooltip.module.css`
- Create: `src/components/HoverTooltip/index.ts`
- Test: `src/core/geo/tooltipPlacement.test.ts`
- Test: `src/components/HoverTooltip/HoverTooltip.test.tsx`

**Interfaces:**
- Produces (pure): `placeTooltip(point, size, viewport, offset?): { x: number; y: number; flippedX: boolean; flippedY: boolean }`
- Produces (React): `HoverTooltip` — `(props: { rollup: RollupResult; names: ReadonlyMap<string, string>; categories: readonly CrimeCategory[]; delayMs?: number }) => JSX.Element`

- [x] **Step 1: Write the failing placement test**

Placement is pure arithmetic, so it belongs in `core/` at 100% coverage.

Create `src/core/geo/tooltipPlacement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPlacement.js';

const VIEWPORT = { width: 1000, height: 600 };
const SIZE = { width: 200, height: 120 };

describe('placeTooltip', () => {
  it('sits below and right of the cursor by the offset', () => {
    expect(placeTooltip([100, 100], SIZE, VIEWPORT, 12)).toMatchObject({ x: 112, y: 112 });
  });

  it('flips horizontally when it would overflow the right edge', () => {
    const placed = placeTooltip([950, 100], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(true);
    expect(placed.x).toBe(950 - 12 - SIZE.width);
  });

  it('flips vertically when it would overflow the bottom edge', () => {
    const placed = placeTooltip([100, 560], SIZE, VIEWPORT, 12);
    expect(placed.flippedY).toBe(true);
    expect(placed.y).toBe(560 - 12 - SIZE.height);
  });

  it('flips both axes in the bottom-right corner', () => {
    const placed = placeTooltip([980, 590], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(true);
    expect(placed.flippedY).toBe(true);
  });

  it('never places the tooltip off the left or top edge, even when flipping would', () => {
    const placed = placeTooltip([5, 5], { width: 400, height: 300 }, { width: 300, height: 200 }, 12);
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.y).toBeGreaterThanOrEqual(0);
  });

  it('does not flip when it fits', () => {
    const placed = placeTooltip([400, 300], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(false);
    expect(placed.flippedY).toBe(false);
  });

  it('uses a 12px offset by default, per the spec', () => {
    expect(placeTooltip([100, 100], SIZE, VIEWPORT)).toMatchObject({ x: 112, y: 112 });
  });

  it('handles an unmeasured tooltip without producing NaN', () => {
    const placed = placeTooltip([100, 100], { width: 0, height: 0 }, VIEWPORT);
    expect(Number.isFinite(placed.x)).toBe(true);
    expect(Number.isFinite(placed.y)).toBe(true);
  });
});
```

- [x] **Step 2: Implement `src/core/geo/tooltipPlacement.ts`**

```ts
import type { Viewport } from '@/core/types/index.js';

export interface TooltipPlacement {
  x: number;
  y: number;
  flippedX: boolean;
  flippedY: boolean;
}

const DEFAULT_OFFSET = 12;

/**
 * Positions the tooltip near the cursor without letting it leave the viewport.
 *
 * Flipping to the other side of the cursor is preferred over merely clamping,
 * because a clamped tooltip sits *under* the pointer and hides the region being
 * described. The final clamp to zero is a last resort for the case where the
 * tooltip is larger than the viewport itself.
 */
export function placeTooltip(
  point: readonly [number, number],
  size: { width: number; height: number },
  viewport: Viewport,
  offset: number = DEFAULT_OFFSET,
): TooltipPlacement {
  const [px, py] = point;

  const flippedX = px + offset + size.width > viewport.width;
  const flippedY = py + offset + size.height > viewport.height;

  const x = flippedX ? px - offset - size.width : px + offset;
  const y = flippedY ? py - offset - size.height : py + offset;

  return { x: Math.max(0, x), y: Math.max(0, y), flippedX, flippedY };
}
```

Export it from `src/core/geo/index.ts`:

```ts
export type { TooltipPlacement } from './tooltipPlacement.js';
export { placeTooltip } from './tooltipPlacement.js';
```

- [x] **Step 3: Run the placement test and check coverage**

```bash
npx vitest run src/core/geo/tooltipPlacement.test.ts
npx vitest run --coverage
```

Expected: PASS, 8 tests, `tooltipPlacement.ts` at 100%.

- [x] **Step 4: Write the failing component test**

Create `src/components/HoverTooltip/HoverTooltip.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIndex, rollup } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { HoverTooltip } from './HoverTooltip.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 900 },
  { year: 2020, ilCode: '34', category: 'darp', count: 300 },
  { year: 2021, ilCode: '34', category: 'hirsizlik', count: 1200 },
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

const NAMES = new Map([['34', 'İstanbul'], ['06', 'Ankara']]);

function setup() {
  const hoverStore = createHoverStore();
  const store = createHeatMapStore(base);
  const rolled = rollup(buildIndex({ data: DATA, categories: CATEGORIES }), 'il', base.filters);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <HoverTooltip rollup={rolled} names={NAMES} categories={CATEGORIES} />,
    { wrapper },
  );
  return { ...utils, hoverStore };
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe('HoverTooltip', () => {
  it('renders nothing when nothing is hovered', () => {
    setup();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays hidden during the anti-flicker delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('appears after the delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('names the hovered region and shows its total', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });

    expect(screen.getByText('İstanbul')).toBeInTheDocument();
    // 900 + 300 + 1200, grouped tr-TR.
    expect(screen.getByText('2.400')).toBeInTheDocument();
  });

  it('lists the top categories with their labels', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByText('Hırsızlık')).toBeInTheDocument();
  });

  it('hides immediately on leave, with no trailing delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });
    act(() => { hoverStore.dispatch({ type: 'leave' }); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says "no data" for a region absent from the rollup', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '06', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByText(trStrings.tooltip.noData)).toBeInTheDocument();
  });

  it('mirrors its content into a live region for screen readers', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { vi.advanceTimersByTime(80); });

    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('İstanbul');
  });

  it('cancels a pending show if the pointer leaves first', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10 } }); });
    act(() => { hoverStore.dispatch({ type: 'leave' }); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
```

- [x] **Step 5: Implement `HoverTooltip`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RollupResult } from '@/core/aggregation/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import { placeTooltip } from '@/core/geo/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget } from '@/hooks/useHoverTarget.js';
import styles from './HoverTooltip.module.css';

/** Long enough to swallow fast traversal, short enough to feel immediate. */
const SHOW_DELAY_MS = 60;
const TOP_CATEGORIES = 3;
/** Used until the tooltip has been measured; keeps the first frame on-screen. */
const ASSUMED_SIZE = { width: 220, height: 130 };

export interface HoverTooltipProps {
  rollup: RollupResult;
  names: ReadonlyMap<string, string>;
  categories: readonly CrimeCategory[];
  delayMs?: number;
}

export function HoverTooltip({
  rollup, names, categories, delayMs = SHOW_DELAY_MS,
}: HoverTooltipProps) {
  const strings = useStrings();
  const hover = useHoverTarget();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Show on a timer, hide immediately. Traversing a dense district map fires
  // dozens of enters per second; without the delay the tooltip strobes.
  useEffect(() => {
    if (hover === null) { setVisible(false); return; }

    const timer = setTimeout(() => { setVisible(true); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [hover?.code, delayMs, hover]);

  const detail = useMemo(() => {
    if (hover === null) return null;

    const aggregate = rollup.byRegion.get(hover.code);
    const name = names.get(hover.code) ?? hover.code;
    if (aggregate === undefined) return { name, total: null, top: [] as const };

    const labels = new Map(categories.map((category) => [category.id, category.label]));
    const top = [...aggregate.byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIES)
      .map(([id, count]) => ({
        id,
        label: labels.get(id) ?? id,
        count,
        share: aggregate.total === 0 ? 0 : count / aggregate.total,
      }));

    return { name, total: aggregate.total, top };
  }, [hover, rollup, names, categories]);

  const placement = useMemo(() => {
    if (hover === null) return null;
    const size = ref.current === null
      ? ASSUMED_SIZE
      : { width: ref.current.offsetWidth, height: ref.current.offsetHeight };
    return placeTooltip(
      [hover.x, hover.y],
      size,
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, [hover]);

  const announcement = detail === null
    ? ''
    : `${detail.name}, ${
      detail.total === null ? strings.tooltip.noData : formatTrNumber(detail.total)
    }`;

  return (
    <>
      {/* Mirrors hover and focus targets for screen readers (§10). */}
      <div className="hm-visually-hidden" aria-live="polite">{announcement}</div>

      {visible && detail !== null && placement !== null ? (
        <div
          ref={ref}
          role="tooltip"
          className={styles.tooltip}
          style={{ transform: `translate(${placement.x}px, ${placement.y}px)` }}
        >
          <p className={styles.name}>{strings.tooltip.title(detail.name)}</p>

          {detail.total === null ? (
            <p className={styles.empty}>{strings.tooltip.noData}</p>
          ) : (
            <>
              <p className={styles.total}>
                <span className={styles.totalLabel}>{strings.tooltip.total}</span>
                <span className={styles.totalValue}>{formatTrNumber(detail.total)}</span>
              </p>

              {detail.top.length > 0 ? (
                <>
                  <p className={styles.section}>{strings.tooltip.topCategories}</p>
                  <ul className={styles.list}>
                    {detail.top.map((entry) => (
                      <li key={entry.id} className={styles.row}>
                        <span className={styles.rowLabel}>{entry.label}</span>
                        <span
                          className={styles.bar}
                          style={{ width: `${Math.round(entry.share * 100)}%` }}
                          aria-hidden="true"
                        />
                        <span className={styles.rowValue}>
                          {formatTrNumber(entry.count)} ({formatPercent(entry.share)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
```

- [x] **Step 6: Add `HoverTooltip.module.css`**

```css
.tooltip {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10;
  min-width: 180px;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--hm-glass-bg-solid);
  border: 1px solid var(--hm-glass-border);
  box-shadow: var(--hm-glass-shadow);
  color: var(--hm-fg);
  font-size: 12px;
  /* The tooltip must never eat the pointer events the map needs. */
  pointer-events: none;
  transition: transform var(--hm-motion-hover) var(--hm-ease-hover);
}

.name { margin: 0 0 6px; font-weight: 600; font-size: 13px; }
.total { display: flex; justify-content: space-between; gap: 12px; margin: 0; }
.totalLabel { color: var(--hm-fg-muted); }
.totalValue { font-variant-numeric: tabular-nums; font-weight: 600; }
.section { margin: 8px 0 4px; font-size: 11px; color: var(--hm-fg-muted); }
.empty { margin: 0; color: var(--hm-fg-muted); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px 8px;
  font-size: 11px;
}

.rowLabel { grid-column: 1; }
.rowValue { grid-column: 2; font-variant-numeric: tabular-nums; }

.bar {
  grid-column: 1 / -1;
  height: 3px;
  border-radius: 2px;
  background: var(--hm-fg-muted);
  opacity: 0.6;
}
```

- [x] **Step 7: Write the barrel and run the tests**

`src/components/HoverTooltip/index.ts`:

```ts
export type { HoverTooltipProps } from './HoverTooltip.js';
export { HoverTooltip } from './HoverTooltip.js';
```

Run: `npx vitest run src/components/HoverTooltip`
Expected: PASS, 9 tests.

- [x] **Step 8: Commit**

```bash
git add src/core/geo/tooltipPlacement.ts src/core/geo/tooltipPlacement.test.ts \
  src/core/geo/index.ts src/components/HoverTooltip
git commit -m "feat(tooltip): add edge-aware hover tooltip with live region"
```

---

## Task 16: Fly-to and the attribution

Two small pieces that finish the map's chrome: an animated viewport transition
used when a region is selected, and the non-removable data credit.

**Files:**
- Create: `src/hooks/useFlyTo.ts`
- Create: `src/components/Attribution/Attribution.tsx`
- Create: `src/components/Attribution/Attribution.module.css`
- Create: `src/components/Attribution/index.ts`
- Test: `src/hooks/useFlyTo.test.tsx`
- Test: `src/components/Attribution/Attribution.test.tsx`

**Interfaces:**
- Consumes: `computeFitTransform` from `core/geo`; `useReducedMotion`; `BBox`.
- Produces:
  - `useFlyTo(viewport): (bbox: BBox) => void`
  - `Attribution` — `() => JSX.Element`

- [x] **Step 1: Write the failing tests**

Create `src/hooks/useFlyTo.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BBox } from '@/core/types/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { useFlyTo } from './useFlyTo.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

const VIEWPORT = { width: 1000, height: 600 };
const TARGET: BBox = [[400, 200], [600, 400]];

/** Hand-driven clock and rAF queue, so the animation is stepped deterministically. */
let now = 0;
let frames: ((t: number) => void)[] = [];

function runFrames(toTime: number): void {
  now = toTime;
  const pending = frames;
  frames = [];
  for (const frame of pending) frame(now);
}

function setup(reducedMotion: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });

  const store = createHeatMapStore(base);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

beforeEach(() => { now = 0; frames = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useFlyTo', () => {
  it('jumps straight to the target under reduced motion', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    expect(store.getState().transform.k).toBeGreaterThan(1);
    // Nothing was scheduled: it was a jump, not an animation.
    expect(frames).toHaveLength(0);
  });

  it('animates over several frames when motion is allowed', () => {
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    // Scheduled, but nothing applied until the first frame runs.
    expect(store.getState().transform.k).toBe(1);

    act(() => { runFrames(300); });
    const midway = store.getState().transform.k;
    expect(midway).toBeGreaterThan(1);

    act(() => { runFrames(600); });
    expect(store.getState().transform.k).toBeGreaterThan(midway);
  });

  it('lands exactly on the fitted transform when the animation completes', () => {
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    act(() => { runFrames(600); });

    const { k, x, y } = store.getState().transform;
    // The target's centre must end up at the viewport's centre.
    expect(500 * k + x).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(300 * k + y).toBeCloseTo(VIEWPORT.height / 2, 0);
  });

  it('reaches the same destination under reduced motion as it does animated', () => {
    const jumped = setup(true);
    const jump = renderHook(() => useFlyTo(VIEWPORT), { wrapper: jumped.wrapper });
    act(() => { jump.result.current(TARGET); });
    const destination = jumped.store.getState().transform;

    vi.unstubAllGlobals();
    now = 0; frames = [];
    const animated = setup(false);
    const fly = renderHook(() => useFlyTo(VIEWPORT), { wrapper: animated.wrapper });
    act(() => { fly.result.current(TARGET); });
    act(() => { runFrames(600); });

    expect(animated.store.getState().transform).toEqual(destination);
  });

  it('stops scheduling once the animation is done', () => {
    const { wrapper } = setup(false);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    act(() => { runFrames(600); });
    expect(frames).toHaveLength(0);
  });

  it('is a no-op on an unmeasured viewport', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(
      () => useFlyTo({ width: 0, height: 0 }),
      { wrapper },
    );
    act(() => { result.current(TARGET); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });
});
```

Create `src/components/Attribution/Attribution.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { Attribution } from './Attribution.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderAttribution() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  return render(<Attribution />, { wrapper });
}

describe('Attribution', () => {
  it('credits OpenStreetMap, which the ODbL licence requires', () => {
    renderAttribution();
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });

  it('names the ODbL licence', () => {
    renderAttribution();
    expect(screen.getByText(/ODbL/u)).toBeInTheDocument();
  });

  it('has an accessible name', () => {
    renderAttribution();
    expect(
      screen.getByRole('note', { name: trStrings.attribution.label }),
    ).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run both tests to verify they fail**

Run: `npx vitest run src/hooks/useFlyTo.test.tsx src/components/Attribution`
Expected: FAIL — modules not found.

- [x] **Step 3: Implement `useFlyTo`**

```ts
import { useCallback, useEffect, useRef } from 'react';
import { MAX_ZOOM, computeFitTransform } from '@/core/geo/index.js';
import type { BBox, Viewport } from '@/core/types/index.js';
import { useHeatMapDispatch, useHeatMapState } from './useHeatMapState.js';
import { useReducedMotion } from './useReducedMotion.js';

const DURATION_MS = 600;

/** cubic-bezier(.4,0,.2,1) approximated as a cubic ease-in-out (§6.7). */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Animates the viewport to fit a bounding box.
 *
 * Under `prefers-reduced-motion` this becomes an instant jump, per §6.7 — the
 * destination is identical either way, only the journey differs.
 */
export function useFlyTo(viewport: Viewport): (bbox: BBox) => void {
  const dispatch = useHeatMapDispatch();
  const reducedMotion = useReducedMotion();
  const transform = useHeatMapState((state) => state.transform);

  // The animation reads the live transform without re-creating the callback on
  // every frame it dispatches — the same ref pattern useMapZoom uses for drag.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const frame = useRef<number | null>(null);

  // A fly-to still running at unmount would dispatch into a dead store on its
  // next frame.
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return useCallback((bbox: BBox) => {
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const target = computeFitTransform(bbox, viewport, { maxScale: MAX_ZOOM });
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    if (reducedMotion) {
      dispatch({ type: 'setTransform', transform: target });
      return;
    }

    // Captured once, before the first frame. Interpolating from the live value
    // each frame would ease toward a moving origin and never quite arrive.
    const from = transformRef.current;
    const start = performance.now();

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = ease(t);

      dispatch({
        type: 'setTransform',
        transform: {
          k: lerp(from.k, target.k, eased),
          x: lerp(from.x, target.x, eased),
          y: lerp(from.y, target.y, eased),
        },
      });

      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };

    frame.current = requestAnimationFrame(step);
  }, [dispatch, viewport, reducedMotion]);
}
```

`transformRef` is assigned during render rather than in an effect. That is safe
here because it is never read during render — only inside the animation
callback — so it cannot produce a torn read.

- [x] **Step 4: Implement `Attribution`**

```tsx
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './Attribution.module.css';

/**
 * Data credit.
 *
 * The boundary data is ODbL/CC-BY-SA, which makes attribution a licence
 * condition rather than a courtesy. It is styleable but always rendered — there
 * is deliberately no prop to remove it (§5.4).
 */
export function Attribution() {
  const strings = useStrings();
  return (
    <p role="note" aria-label={strings.attribution.label} className={styles.attribution}>
      {strings.attribution.text}
    </p>
  );
}
```

`Attribution.module.css`:

```css
.attribution {
  margin: 0;
  padding: 2px 6px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--hm-fg-muted);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  pointer-events: auto;
}
```

`src/components/Attribution/index.ts`:

```ts
export { Attribution } from './Attribution.js';
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/useFlyTo.test.tsx src/components/Attribution`
Expected: PASS, 6 fly-to tests + 3 attribution tests.

- [x] **Step 6: Commit**

```bash
git add src/hooks/useFlyTo.ts src/hooks/useFlyTo.test.tsx src/components/Attribution
git commit -m "feat(map): add animated fly-to and mandatory data attribution"
```

---

## Task 17: Align the mock dataset with the real geography

The mock generator picks its district count from a population weight, so its
`{plaka}{NN}` codes only partly overlap the shipped geography: some provinces
get records for districts that do not exist, others have real districts with no
records. The demo and every future screenshot are misleading until this agrees.

**Files:**
- Modify: `src/data/mock/generate.ts`
- Modify: `src/data/mock/generate.test.ts`

**Interfaces:**
- Consumes: `getLevelRegionMeta` from Task 4.
- Produces: unchanged public signature — `generateMockData(options): MockDataset`. `ilceNames` now carries real district names.

- [x] **Step 1: Write the failing test**

Add to `src/data/mock/generate.test.ts`:

```ts
import { getLevelRegionMeta } from '@/data/geo/index.js';

describe('generateMockData — agreement with the shipped geography', () => {
  it('emits only ilçe codes that exist in the bundled geography', () => {
    const { records } = generateMockData({ seed: 7 });
    const real = getLevelRegionMeta('ilce');

    const unknown = new Set(
      records
        .map((record) => record.ilceCode)
        .filter((code): code is string => code !== undefined)
        .filter((code) => !real.has(code)),
    );
    expect([...unknown]).toEqual([]);
  });

  it('covers every real district, so no region renders as no-data by accident', () => {
    const { records } = generateMockData({ seed: 7 });
    const covered = new Set(records.map((record) => record.ilceCode));
    for (const code of getLevelRegionMeta('ilce').keys()) {
      expect(covered.has(code)).toBe(true);
    }
  });

  it('names districts from the geography rather than inventing labels', () => {
    const { ilceNames } = generateMockData({ seed: 7 });
    expect(ilceNames.get('3401')).toBe(getLevelRegionMeta('ilce').get('3401')?.name);
  });

  it('stays reproducible from a seed', () => {
    const a = generateMockData({ seed: 99 });
    const b = generateMockData({ seed: 99 });
    expect(a.records).toEqual(b.records);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/mock/generate.test.ts`
Expected: FAIL — unknown codes present, and coverage incomplete.

- [x] **Step 3: Drive district codes from the geography**

In `src/data/mock/generate.ts`, replace the synthetic district loop:

```ts
    const codes: string[] = [];
    for (let d = 1; d <= districts; d += 1) {
      const ilceCode = `${il.code}${String(d).padStart(2, '0')}`;
      codes.push(ilceCode);
      ilceNames.set(ilceCode, `${il.name} ${d}. Bölge`);
    }
```

with a lookup against the real geography:

```ts
    // Districts come from the shipped geography rather than a synthetic count,
    // so every generated record lands on a region the map can actually paint
    // and every region on the map has data. The population weight still shapes
    // the *magnitudes* below; it no longer invents the administrative division.
    const codes: string[] = [];
    for (const [code, meta] of realDistricts) {
      if (meta.parentCode !== il.code) continue;
      codes.push(code);
      ilceNames.set(code, meta.name);
    }
```

and add, above the `for (const il of IL_REGIONS)` loop:

```ts
  const realDistricts = getLevelRegionMeta('ilce');
```

with the import:

```ts
import { getLevelRegionMeta } from '@/data/geo/index.js';
```

`districtCount` is now unused — delete it and its `IL_WEIGHTS`-derived helper if
nothing else references them, or ESLint will flag the dead code.

- [x] **Step 4: Watch for a circular import**

`src/data/geo/index.ts` must not import from `src/data/mock/`. Confirm:

```bash
npx vitest run src/data/mock/generate.test.ts
```

If the run fails with an undefined import at module load, the cycle is real —
import `getLevelRegionMeta` from `@/data/geo/topology.js` directly rather than
through the barrel.

- [x] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/data/mock
```

Expected: PASS, including the existing reproducibility and parent-code tests.
The record count rises — 973 real districts against roughly 600 synthetic ones
before — so any test asserting an exact record count needs its expectation
updated to the new number rather than being deleted.

- [x] **Step 6: Confirm the performance guard still holds**

```bash
npx vitest run src/core/aggregation/performance.test.ts
```

The guard runs at >50,000 records and the dataset just grew. If it now exceeds
its budget, that is a real regression to investigate, not a threshold to raise.

- [x] **Step 7: Commit**

```bash
git add src/data/mock
git commit -m "fix(data): generate mock districts from the shipped geography"
```

---

## Task 18: The `CrimeHeatMap` root component

Mounts the provider, applies the prop reconciliation rules from §8, catches
render failures, and lays out the map with its legend, tooltip and attribution.

**Files:**
- Create: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`
- Create: `src/components/CrimeHeatMap/ErrorBoundary.tsx`
- Create: `src/components/CrimeHeatMap/reconcile.ts`
- Create: `src/components/CrimeHeatMap/CrimeHeatMap.module.css`
- Create: `src/components/CrimeHeatMap/index.ts`
- Test: `src/components/CrimeHeatMap/reconcile.test.ts`
- Test: `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`

**Interfaces:**
- Produces:
  - `CrimeHeatMapProps` — the public prop shape from §8
  - `CrimeHeatMap` — the package's entry component
  - `reconcileProps(props, index): { filters; level; metric; warnings }`

- [x] **Step 1: Write the failing reconciliation test**

Create `src/components/CrimeHeatMap/reconcile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { reconcileProps } from './reconcile.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const DATA: CrimeRecord[] = [
  { year: 2018, ilCode: '34', category: 'hirsizlik', count: 10 },
  { year: 2022, ilCode: '06', category: 'darp', count: 20 },
];

const index = buildIndex({ data: DATA, categories: CATEGORIES });

describe('reconcileProps — year range', () => {
  it('clamps a range that overhangs the data span', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2000, 2100], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2022]);
  });

  it('falls back to the full span and warns when the range misses entirely', () => {
    const { filters, warnings } = reconcileProps(
      { defaultFilters: { yearRange: [1990, 1995], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2022]);
    expect(warnings.some((w) => w.includes('yıl'))).toBe(true);
  });

  it('keeps a valid range untouched', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2018], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2018]);
  });

  it('defaults to the full span when no range is given', () => {
    expect(reconcileProps({}, index).filters.yearRange).toEqual([2018, 2022]);
  });
});

describe('reconcileProps — categories', () => {
  it('drops unknown categories and warns', () => {
    const { filters, warnings } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2022], categories: ['hirsizlik', 'yok'] } },
      index,
    );
    expect(filters.categories).toEqual(['hirsizlik']);
    expect(warnings.some((w) => w.includes('kategori'))).toBe(true);
  });

  it('keeps known categories', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2022], categories: ['darp'] } },
      index,
    );
    expect(filters.categories).toEqual(['darp']);
  });
});

describe('reconcileProps — metric', () => {
  it('falls back to total when perCapita is asked for without population', () => {
    const { metric, warnings } = reconcileProps({ metric: 'perCapita' }, index);
    expect(metric).toBe('total');
    expect(warnings.some((w) => w.includes('nüfus'))).toBe(true);
  });

  it('honours perCapita when population is supplied', () => {
    const { metric } = reconcileProps(
      { metric: 'perCapita', population: [{ ilCode: '34', year: 2018, population: 1 }] },
      index,
    );
    expect(metric).toBe('perCapita');
  });
});

describe('reconcileProps — level', () => {
  it('falls back to il when ilce is requested on an il-only dataset', () => {
    const { level, warnings } = reconcileProps(
      { defaultView: { level: 'ilce', focusedIl: null } },
      index,
    );
    expect(level).toBe('il');
    expect(warnings.some((w) => w.includes('ilçe'))).toBe(true);
  });

  it('honours ilce when the data has district codes', () => {
    const withIlce = buildIndex({
      data: [{ year: 2020, ilCode: '34', ilceCode: '3401', category: 'darp', count: 1 }],
      categories: CATEGORIES,
    });
    expect(reconcileProps({ defaultView: { level: 'ilce', focusedIl: null } }, withIlce).level)
      .toBe('ilce');
  });

  it('defaults to il', () => {
    expect(reconcileProps({}, index).level).toBe('il');
  });
});

describe('reconcileProps — empty data', () => {
  it('produces a usable filter set rather than NaN years', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    const { filters } = reconcileProps({}, empty);
    expect(Number.isFinite(filters.yearRange[0])).toBe(true);
    expect(filters.yearRange[0]).toBeLessThanOrEqual(filters.yearRange[1]);
  });
});
```

- [x] **Step 2: Implement `reconcile.ts`**

```ts
import type { CrimeIndex } from '@/core/aggregation/index.js';
import type {
  FilterSet, GeoLevel, MetricMode, RegionPopulation,
} from '@/core/types/index.js';

export interface ReconcileInput {
  defaultFilters?: { yearRange?: [number, number]; categories?: readonly string[] };
  defaultView?: { level?: GeoLevel; focusedIl?: string | null };
  metric?: MetricMode;
  population?: readonly RegionPopulation[];
}

export interface ReconcileResult {
  filters: FilterSet;
  level: GeoLevel;
  metric: MetricMode;
  /** Turkish messages for onDataWarning and the debug overlay. */
  warnings: string[];
}

/** Fallback span when the dataset carries no usable years at all. */
const FALLBACK_YEAR = new Date().getFullYear();

/**
 * Applies the prop reconciliation rules from §8.
 *
 * Every rule resolves to a defined behaviour and a warning rather than an
 * exception: a consumer passing a stale year range should get a usable map and
 * a diagnostic, not a blank component.
 */
export function reconcileProps(input: ReconcileInput, index: CrimeIndex): ReconcileResult {
  const warnings: string[] = [];

  const years = index.years;
  const dataMin = years[0] ?? FALLBACK_YEAR;
  const dataMax = years[years.length - 1] ?? FALLBACK_YEAR;

  // --- Year range ---
  const requested = input.defaultFilters?.yearRange;
  let yearRange: [number, number] = [dataMin, dataMax];

  if (requested !== undefined) {
    const [reqStart, reqEnd] = requested;
    const start = Math.min(reqStart, reqEnd);
    const end = Math.max(reqStart, reqEnd);

    if (end < dataMin || start > dataMax) {
      warnings.push('İstenen yıl aralığı veriyle örtüşmüyor; tam aralığa dönüldü.');
    } else {
      yearRange = [Math.max(start, dataMin), Math.min(end, dataMax)];
    }
  }

  // --- Categories ---
  const knownCategories = new Set(index.categories);
  const requestedCategories = input.defaultFilters?.categories ?? [];
  const categories = requestedCategories.filter((id) => knownCategories.has(id));
  if (categories.length !== requestedCategories.length) {
    warnings.push('Tanınmayan kategori seçimleri yok sayıldı.');
  }

  // --- Metric ---
  let metric: MetricMode = input.metric ?? 'total';
  if (metric === 'perCapita' && (input.population === undefined || input.population.length === 0)) {
    warnings.push('Nüfus verisi olmadan kişi başı ölçüm yapılamaz; toplama dönüldü.');
    metric = 'total';
  }

  // --- Level ---
  let level: GeoLevel = input.defaultView?.level ?? 'il';
  if (level === 'ilce' && !index.hasIlceData) {
    warnings.push('Veride ilçe kodu yok; il düzeyine dönüldü.');
    level = 'il';
  }

  return { filters: { yearRange, categories }, level, metric, warnings };
}
```

- [x] **Step 3: Run the reconciliation test**

Run: `npx vitest run src/components/CrimeHeatMap/reconcile.test.ts`
Expected: PASS, 13 tests.

- [x] **Step 4: Implement the error boundary**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?(error: Error): void;
}

interface State { hasError: boolean }

/**
 * Contains a render failure inside the component's own box.
 *
 * This is a library dropped into someone else's page; a crash here must not
 * take that page down with it (§8).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

- [x] **Step 5: Write the failing root-component test**

Create `src/components/CrimeHeatMap/CrimeHeatMap.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CrimeHeatMap } from './CrimeHeatMap.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2021, ilCode: '06', category: 'hirsizlik', count: 40 },
];

describe('CrimeHeatMap', () => {
  it('renders the map', () => {
    render(<CrimeHeatMap data={DATA} categories={CATEGORIES} testViewport={{ width: 800, height: 500 }} />);
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('renders the legend', () => {
    render(<CrimeHeatMap data={DATA} categories={CATEGORIES} testViewport={{ width: 800, height: 500 }} />);
    expect(screen.getByRole('group', { name: trStrings.legend.title })).toBeInTheDocument();
  });

  it('always renders the attribution', () => {
    render(<CrimeHeatMap data={DATA} categories={CATEGORIES} testViewport={{ width: 800, height: 500 }} />);
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });

  it('applies string overrides', () => {
    render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        strings={{ legend: { title: 'Anahtar' } }}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Anahtar' })).toBeInTheDocument();
  });

  it('reports reconciliation warnings to the consumer', () => {
    const onDataWarning = vi.fn();
    render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        metric="perCapita"
        onDataWarning={onDataWarning}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect(onDataWarning).toHaveBeenCalled();
  });

  it('does not mount the legend when that panel is disabled', () => {
    render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        panels={{ legend: false }}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect(screen.queryByRole('group', { name: trStrings.legend.title })).not.toBeInTheDocument();
  });

  it('still renders the map when every panel is disabled, since the map is the point', () => {
    render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        panels={{ legend: false, tooltip: false }}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('applies theme token overrides to its own root only', () => {
    const { container } = render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        theme={{ '--hm-radius': '4px' }}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--hm-radius'))
      .toBe('4px');
  });

  it('survives an empty dataset', () => {
    render(<CrimeHeatMap data={[]} categories={CATEGORIES} testViewport={{ width: 800, height: 500 }} />);
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('shows a Turkish fallback and calls onError when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    // A ramp that throws forces a render failure inside the tree.
    render(
      <CrimeHeatMap
        data={DATA}
        categories={CATEGORIES}
        colorScale={() => { throw new Error('patlama'); }}
        onError={onError}
        testViewport={{ width: 800, height: 500 }}
      />,
    );
    expect(screen.getByText(trStrings.error.title)).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [x] **Step 6: Implement `CrimeHeatMap`**

```tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import { buildIndex } from '@/core/aggregation/index.js';
import type {
  CrimeCategory, CrimeRecord, GeoLevel, MetricMode, RegionPopulation,
  ScaleMode, Viewport,
} from '@/core/types/index.js';
import { Attribution } from '@/components/Attribution/index.js';
import { HoverTooltip } from '@/components/HoverTooltip/index.js';
import { Legend } from '@/components/Legend/index.js';
import { MapCanvas, type HeatStyle, type RegionClickPayload } from '@/components/MapCanvas/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { mergeStrings, type PartialStrings } from '@/i18n/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { reconcileProps } from './reconcile.js';
import styles from './CrimeHeatMap.module.css';
import '@/styles/index.js';

export interface PanelFlags {
  legend?: boolean;
  tooltip?: boolean;
  /** Phase 3 panels. Accepted now so the prop shape is stable. */
  sidebar?: boolean; search?: boolean; filters?: boolean;
  pie?: boolean; trend?: boolean; compare?: boolean;
}

export interface CrimeHeatMapProps {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  population?: readonly RegionPopulation[];
  panels?: PanelFlags;
  defaultFilters?: { yearRange?: [number, number]; categories?: readonly string[] };
  defaultView?: { level?: GeoLevel; focusedIl?: string | null };
  colorScale?: ColorScaleName | RampFn;
  scaleMode?: ScaleMode;
  heatStyle?: HeatStyle;
  metric?: MetricMode;
  strings?: PartialStrings;
  theme?: Record<string, string>;
  className?: string;
  style?: CSSProperties;
  debug?: boolean;
  onRegionClick?(region: RegionClickPayload): void;
  onDataWarning?(warnings: readonly string[]): void;
  onError?(error: Error): void;
  /** Test-only size override; jsdom reports every element as 0x0. */
  testViewport?: Viewport;
}

/** Inner tree, so the error boundary can wrap everything that can throw. */
function Content(props: CrimeHeatMapProps & { panels: Required<Pick<PanelFlags, 'legend' | 'tooltip'>> }) {
  const { data, categories, colorScale = 'spectral', heatStyle = 'glow', panels } = props;
  const { rollup, scale, names } = useAggregates({ data, categories, colorScale });

  return (
    <>
      <MapCanvas
        data={data}
        categories={categories}
        colorScale={colorScale}
        heatStyle={heatStyle}
        onRegionClick={props.onRegionClick}
        testViewport={props.testViewport}
      />

      <div className="hm-overlay">
        <div className={styles.bottomLeft}>
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

/** Türkiye crime heat map. */
export function CrimeHeatMap(props: CrimeHeatMapProps) {
  const {
    data, categories, scaleMode = 'quantile', strings: overrides,
    theme, className, style, panels, onDataWarning, onError,
  } = props;

  const strings = useMemo(() => mergeStrings(overrides), [overrides]);

  // Built once for reconciliation; useAggregates memoizes its own on the same
  // inputs, so this costs one extra pass at mount rather than one per render.
  const index = useMemo(() => {
    const knownIlceCodes = new Set(getLevelRegionMeta('ilce').keys());
    return buildIndex({ data, categories, knownIlceCodes });
  }, [data, categories]);

  const reconciled = useMemo(() => reconcileProps(props, index), [props, index]);

  // Report reconciliation and validation warnings once per distinct set.
  const reported = useRef<string>('');
  const allWarnings = useMemo(
    () => [...reconciled.warnings, ...index.warnings.map((warning) => warning.message)],
    [reconciled, index],
  );
  const key = allWarnings.join('|');
  if (key !== reported.current) {
    reported.current = key;
    if (allWarnings.length > 0) onDataWarning?.(allWarnings);
  }

  const [store] = useState(() => createHeatMapStore({
    level: reconciled.level,
    transform: { k: 1, x: 0, y: 0 },
    focusedCode: null,
    selectedCode: null,
    filters: reconciled.filters,
    metric: reconciled.metric,
    scaleMode,
  }));
  const [hoverStore] = useState(createHoverStore);

  const rootStyle = useMemo(() => ({ ...style, ...theme }) as CSSProperties, [style, theme]);

  const resolvedPanels = {
    legend: panels?.legend ?? true,
    tooltip: panels?.tooltip ?? true,
  };

  const onBoundaryError = useCallback((error: Error) => { onError?.(error); }, [onError]);

  return (
    <div
      className={className === undefined ? 'hm-root' : `hm-root ${className}`}
      style={rootStyle}
    >
      <HeatMapProvider store={store} hoverStore={hoverStore} strings={strings}>
        <ErrorBoundary
          onError={onBoundaryError}
          fallback={
            <div className={styles.error} role="alert">
              <p className={styles.errorTitle}>{strings.error.title}</p>
              <p className={styles.errorBody}>{strings.error.body}</p>
            </div>
          }
        >
          <Content {...props} panels={resolvedPanels} />
        </ErrorBoundary>
      </HeatMapProvider>
    </div>
  );
}
```

- [x] **Step 7: Add `CrimeHeatMap.module.css`**

```css
.bottomLeft {
  grid-column: 1;
  grid-row: 3;
  align-self: end;
  display: grid;
  gap: 6px;
  justify-items: start;
}

.error {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 4px;
  text-align: center;
  padding: 24px;
  color: var(--hm-fg);
}

.errorTitle { margin: 0; font-weight: 600; }
.errorBody { margin: 0; color: var(--hm-fg-muted); font-size: 13px; }
```

- [x] **Step 8: Write the barrel and run the tests**

`src/components/CrimeHeatMap/index.ts`:

```ts
export type { CrimeHeatMapProps, PanelFlags } from './CrimeHeatMap.js';
export { CrimeHeatMap } from './CrimeHeatMap.js';
```

Run: `npx vitest run src/components/CrimeHeatMap`
Expected: PASS, 13 + 10 tests.

The `reconcileProps(props, index)` memo depends on `props`, which is a fresh
object every render. If profiling shows this matters, narrow the dependency list
to the individual fields it reads — but do not do it speculatively.

- [x] **Step 9: Commit**

```bash
git add src/components/CrimeHeatMap
git commit -m "feat(component): add CrimeHeatMap root with prop reconciliation"
```

---

## Task 19: Public API, playground, and Phase 2 exit verification

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`
- Modify: `playground/main.tsx`
- Modify: `README.md`
- Modify: `vite.config.ts` (CSS output name)

- [x] **Step 1: Extend the public barrel**

Add to `src/index.ts`, keeping the Phase 1 exports:

```ts
// Components
export type {
  CrimeHeatMapProps, PanelFlags,
} from './components/CrimeHeatMap/index.js';
export { CrimeHeatMap } from './components/CrimeHeatMap/index.js';
export type { HeatStyle, RegionClickPayload } from './components/MapCanvas/index.js';

// Strings
export type { PartialStrings, Strings } from './i18n/index.js';
export { mergeStrings, trStrings } from './i18n/index.js';

// Geography
export {
  LEVELS, getLevelFeatures, getLevelRegionMeta,
} from './data/geo/index.js';
```

- [x] **Step 2: Extend the public-surface test**

Add to `src/index.test.ts`:

```ts
describe('Phase 2 public surface', () => {
  it('exports the component', async () => {
    const api = await import('./index.js');
    expect(typeof api.CrimeHeatMap).toBe('function');
  });

  it('exports the Turkish string table and its merger', async () => {
    const api = await import('./index.js');
    expect(api.trStrings.level.il).toBe('İl');
    expect(typeof api.mergeStrings).toBe('function');
  });

  it('exports the bundled geography', async () => {
    const api = await import('./index.js');
    expect(api.getLevelFeatures('il').features).toHaveLength(81);
    expect(api.getLevelFeatures('ilce').features).toHaveLength(973);
  });
});
```

Run: `npx vitest run src/index.test.ts`
Expected: PASS.

- [x] **Step 3: Point the playground at the real component**

Replace `playground/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CrimeHeatMap } from '../src/index.js';
import { generateMockData } from '../src/data/mock/index.js';

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const dataset = generateMockData({ seed: 42, years: YEARS, includeIlce: true });

const root = document.getElementById('root');
if (root === null) throw new Error('#root yok');

createRoot(root).render(
  <StrictMode>
    <CrimeHeatMap
      data={dataset.records}
      categories={dataset.categories}
      population={dataset.population}
      onRegionClick={(region) => { console.log('[playground]', region); }}
      onDataWarning={(warnings) => { console.warn('[playground]', warnings); }}
    />
  </StrictMode>,
);
```

- [x] **Step 4: Verify the map by eye**

Run `npm run playground` and confirm:

- Türkiye is recognisable, fills the frame, and is coloured across the full ramp
- the legend reads `Yüzdelik` and lists numbers beside every swatch
- hovering a province shows its name, total, and top categories after a beat
- the tooltip flips near the right and bottom edges instead of being clipped
- the attribution is visible in the corner
- wheel zooms toward the cursor; drag pans; borders stay hairline
- past roughly 2.65× the map switches to districts, **all of which are now
  coloured** — Task 17 made the mock data cover every real district
- clicking a province outlines it; Escape clears it
- Tab focuses the map, arrow keys move between regions, Enter selects

- [x] **Step 5: Check accessibility by keyboard alone**

With the pointer untouched: Tab into the map, arrow through several regions, and
confirm the focus ring is clearly visible against both light and dark fills, and
that a screen reader announces each region's name and value.

- [x] **Step 6: Verify the bundle**

```bash
npm run build
grep -c 'from "react"' dist/index.mjs
ls -la dist/
node -e "const{gzipSync}=require('node:zlib'),fs=require('fs');const b=fs.readFileSync('dist/index.mjs');console.log('gzip:',Math.round(gzipSync(b,{level:9}).byteLength/1024)+'KB');"
```

Confirm:
- `grep` returns `0` — React is not bundled
- `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts` and `dist/style.css` exist
- gzipped size is roughly 100–160 KB. The §9 budget is 60 KB **excluding** geo
  plus 120 KB for geo; the geometry alone is 98 KB gzipped, so subtract it before
  judging. If the non-geo remainder exceeds 60 KB, record the number in the
  commit message rather than silently accepting it.

If `dist/style.css` is missing, add `cssFileName: 'style'` to `build.lib` in
`vite.config.ts` (Vite 6+) or rename the emitted asset via `assetFileNames`.

- [x] **Step 7: Verify the package contents**

```bash
npm pack --dry-run
```

Confirm `dist/`, `README.md` and `LICENSE` ship, and nothing from `src/`,
`scripts/`, `playground/` or `docs/`.

- [x] **Step 8: Run the full verification**

```bash
npm run verify
```

Every line must actually pass:
- `typecheck` — no errors
- `lint` — clean, including the `core/`-purity rule
- all tests pass
- `src/core` still at **100% branch coverage** — Phase 2 added `zoom.ts` and
  `tooltipPlacement.ts` to `core/`, and both are covered

Then confirm the purity rule specifically:

```bash
npx eslint src/core --max-warnings 0
```

- [x] **Step 9: Update the README**

Replace the "Şu an neler var" section to reflect that the map now renders, and
add a quick-start:

````markdown
## Kurulum

    npm install turkiye-suc-haritasi

## Hızlı başlangıç

```tsx
import { CrimeHeatMap, generateMockData } from 'turkiye-suc-haritasi';
import 'turkiye-suc-haritasi/style.css';

const veri = generateMockData({ seed: 1 });

<div style={{ height: 600 }}>
  <CrimeHeatMap data={veri.records} categories={veri.categories} />
</div>
```

Bileşen yüksekliği olan bir kapsayıcı bekler; harita kapsayıcıyı doldurur.

## Şu an neler var

| Alan | Ne işe yarar |
|---|---|
| `CrimeHeatMap` | İl ve ilçe düzeyinde etkileşimli ısı haritası, gösterge ve ipucu |
| `buildIndex`, `rollup`, `rankRegions`, `diffRollups` | Suç kayıtlarını doğrular, filtreler ve bölge bazında toplar |
| `createColorScale`, `computeLegendBreaks` | Algısal olarak eşit aralıklı OKLab renk skalaları |
| `foldTurkish`, `compareTurkish`, `searchEntities` | Türkçe'ye duyarlı arama ve sıralama |
| `formatTrNumber`, `formatPercent`, `formatDelta` | Deterministik `tr-TR` sayı biçimlendirme |
| `getLevelFeatures` | Paketle gelen il/ilçe sınır verisi |
| `generateMockData` | Tohumlanmış, tekrarlanabilir örnek veri seti |

Kenar çubuğu, arama, filtreler ve grafikler Faz 3'te gelir.

## Sınır verisi ve atıf

Sınır verisi OpenStreetMap türevidir (geoBoundaries, ODbL). Atıf zorunludur ve
harita köşesinde her zaman görünür — kaldıran bir prop bilinçli olarak yoktur.

İlçe kodları `{plaka}{sıra}` biçimindedir ve resmî TÜİK kimlikleri **değildir**.
Ayrıntı için `scripts/README.md`.
````

- [x] **Step 10: Commit and tag**

```bash
git add src/index.ts src/index.test.ts playground/main.tsx README.md vite.config.ts
git commit -m "feat: expose CrimeHeatMap, wire playground, document phase 2"
git tag phase-2-complete
```

---

## Phase 2 exit criteria

Each must be **verified by running it**, not assumed:

- [x] `npm run verify` passes end to end
- [x] `src/core` is at 100% branch coverage, including `zoom.ts` and `tooltipPlacement.ts`
- [x] `npx eslint src/core` is clean — no React import, no DOM global
- [x] `grep -c 'from "react"' dist/index.mjs` returns 0
- [x] `npm run build` produces ESM, CJS, types, and `dist/style.css`
- [x] `npm pack --dry-run` ships `dist/` only
- [x] The playground renders a recognisable Türkiye with varied colour at both levels
- [x] Wheel zoom anchors on the cursor; drag pans; borders stay hairline at k=12
- [x] Level switches near 2.65× and does not flicker when held at the threshold
- [x] Hover tooltip appears after a beat, follows the cursor, and flips at the edges
- [x] Map is fully keyboard-operable with a visible focus ring, and regions are announced
- [x] Attribution is visible and has no prop that removes it
- [x] Every mock district code exists in the shipped geography, and every district has data

## What Phase 3 needs from Phase 2

Phase 3 (panels) consumes, and must not have to change:

- `useHeatMapState(selector)` / `useHeatMapDispatch()` — the subscription contract
- `HeatMapState` and `HeatMapAction` — extended with filter and compare actions
- `useAggregates` — the memoized index/rollup/scale every panel reads
- `useHoverTarget` — sidebar↔map hover linking depends on hover staying out of the main store
- `useFlyTo` — sidebar row click and search result selection both fly the map
- `GlassPanel` and the `hm-overlay` grid — where Phase 3 panels mount
- `Strings` — extended per panel; adding a key is a compile error until translated
- `PanelFlags` — already accepts every Phase 3 flag, so the prop shape does not change
