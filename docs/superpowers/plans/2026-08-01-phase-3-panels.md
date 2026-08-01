# Türkiye Suç Haritası — Phase 3: Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surround the working map with its five panels — sidebar, search, filter bar, category pie and trend chart — each independently mountable, laid out over the map without blocking it, and reflowing when one is switched off.

**Architecture:** Every panel subscribes to the store by selector, so a filter change repaints only what depends on it and pointer movement still repaints nothing but the tooltip. All geometry and windowing maths — arc paths, line paths, slider positions, virtual-list windows — lives in `core/` as pure functions under the 100% coverage rule, leaving each component thin enough to read in one screen. Panels never import each other.

**Tech Stack:** React 18/19 (peer dep), TypeScript, CSS Modules, Vitest + React Testing Library (jsdom), hand-built SVG charts — no chart library.

## Global Constraints

Copied from the spec; every task inherits these.

- **`core/` never imports React and never touches the DOM.** Enforced by ESLint. Move logic rather than weakening the rule.
- **`core/` stays at 100% branch coverage.** Every pure function this phase adds needs full tests.
- **React is a peer dependency, never bundled.**
- **Runtime deps stay exactly `d3-geo` and `topojson-client`.** The charts are hand-built for this reason — no Recharts, no d3-shape.
- **No `Math.random()` anywhere in `src/`.** Enforced by ESLint.
- **Every user-facing string is Turkish** and comes from the `Strings` table — never hardcoded in a component. Adding a key to `Strings` is a compile error in `tr.ts` until it is translated; that is the intended workflow.
- **All motion collapses to 0 under `prefers-reduced-motion: reduce`** — use the `--hm-motion-*` tokens, which already do this.
- **Numbers always accompany colour** (§6.5). This applies to the charts as much as the map.
- **Panels are independently mountable (§7.8):** `false` means the panel never mounts — no hidden DOM, no wasted computation. No panel may import another, read another's DOM, or be a precondition for another's state.
- **The map always renders.** It is the component's reason to exist.
- **File size discipline:** any component over ~200 lines is a signal to split.
- **tr-TR formatting comes from `core/format`** — never `toLocaleString`, which silently falls back to `en-US` on small-icu Node builds.

## Phase Scope

**In:** `Sidebar`, `SearchBar`, `FilterBar`, `CategoryPieChart`, `TrendChart`, the primitives they need, the store actions they dispatch, the layout grid that positions them, the panel enable/disable matrix, and responsive reflow.

**Out (Phase 4+):** Compare mode and the `CompareBar` — `PanelFlags.compare` is accepted but mounts nothing. `DebugOverlay`, the E2E suite and the performance assertions are Phase 5.

## File Structure

```
src/
├─ core/
│  ├─ chart/
│  │  ├─ scale.ts          # linear numeric scale, both directions
│  │  ├─ arc.ts            # donut arc path geometry
│  │  ├─ line.ts           # polyline and area path builders
│  │  ├─ collapse.ts       # fold slices below a share into "Diğer"
│  │  ├─ palette.ts        # categorical colours for the pie
│  │  └─ index.ts
│  └─ list/
│     ├─ window.ts         # virtual-list window computation
│     └─ index.ts
├─ components/
│  ├─ primitives/
│  │  ├─ IconButton.tsx
│  │  ├─ Chip.tsx
│  │  └─ RangeSlider.tsx
│  ├─ Sidebar/
│  ├─ SearchBar/
│  ├─ FilterBar/
│  ├─ CategoryPieChart/
│  └─ TrendChart/
└─ hooks/
   ├─ useSearchIndex.ts    # memoized search entity index
   └─ useVirtualList.ts    # scroll tracking around core/list/window
```

---

## Task 1: Store actions for filtering

The filter bar, the trend chart and the search dropdown all change filters, and
each needs a narrower action than "replace the whole filter set" — a chip toggle
that rebuilds the array from a stale closure would drop a concurrent year
change. Defaults move into the store so `Sıfırla` has something to reset to.

**Files:**
- Modify: `src/context/HeatMapStore.ts`
- Modify: `src/context/HeatMapStore.test.ts`
- Modify: `src/components/CrimeHeatMap/CrimeHeatMap.tsx`

**Interfaces:**
- Consumes: `HeatMapState`, `HeatMapAction`, `FilterSet` from Phase 2.
- Produces, added to `HeatMapAction`:
  - `{ type: 'setYearRange'; range: [number, number] }`
  - `{ type: 'toggleCategory'; id: string }`
  - `{ type: 'resetFilters' }`
- Produces, added to `HeatMapState`:
  - `defaultFilters: FilterSet` — what `resetFilters` restores
  - `yearBounds: [number, number]` — the data's full span, for the slider's extent

- [ ] **Step 1: Write the failing tests**

Add to `src/context/HeatMapStore.test.ts`, inside the existing
`describe('heatMapReducer')`:

```ts
  it('sets a year range', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2020] });
    expect(next.filters.yearRange).toEqual([2018, 2020]);
  });

  it('normalizes a reversed year range rather than producing an empty selection', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [2020, 2018] });
    expect(next.filters.yearRange).toEqual([2018, 2020]);
  });

  it('clamps a year range to the data bounds', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [1900, 2999] });
    expect(next.filters.yearRange).toEqual(base.yearBounds);
  });

  it('adds a category on first toggle', () => {
    const next = heatMapReducer(base, { type: 'toggleCategory', id: 'hirsizlik' });
    expect(next.filters.categories).toEqual(['hirsizlik']);
  });

  it('removes a category on second toggle', () => {
    const on = heatMapReducer(base, { type: 'toggleCategory', id: 'hirsizlik' });
    const off = heatMapReducer(on, { type: 'toggleCategory', id: 'hirsizlik' });
    expect(off.filters.categories).toEqual([]);
  });

  it('keeps other categories when toggling one', () => {
    let state = heatMapReducer(base, { type: 'toggleCategory', id: 'a' });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'b' });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'a' });
    expect(state.filters.categories).toEqual(['b']);
  });

  it('preserves the year range when toggling a category', () => {
    const ranged = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2019] });
    const toggled = heatMapReducer(ranged, { type: 'toggleCategory', id: 'a' });
    expect(toggled.filters.yearRange).toEqual([2018, 2019]);
  });

  it('restores the defaults on reset without touching the view', () => {
    let state = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2018] });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'a' });
    state = heatMapReducer(state, { type: 'setTransform', transform: { k: 4, x: -1, y: -2 } });

    const reset = heatMapReducer(state, { type: 'resetFilters' });
    expect(reset.filters).toEqual(base.defaultFilters);
    // Resetting filters is not resetting the map.
    expect(reset.transform).toEqual({ k: 4, x: -1, y: -2 });
  });

  it('returns the same object when reset changes nothing', () => {
    expect(heatMapReducer(base, { type: 'resetFilters' })).toBe(base);
  });
```

Extend the shared `base` fixture at the top of that file:

```ts
const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  metric: 'total',
  scaleMode: 'quantile',
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/context/HeatMapStore.test.ts`
Expected: FAIL — `defaultFilters` and `yearBounds` are not on `HeatMapState`,
and the three new action types do not exist.

- [ ] **Step 3: Extend the state and action types**

In `src/context/HeatMapStore.ts`, add to `HeatMapState`:

```ts
  /** What `resetFilters` restores. Set once from the reconciled props. */
  defaultFilters: FilterSet;
  /** The data's full year span. The slider's extent, and the reset clamp. */
  yearBounds: [number, number];
```

and to `HeatMapAction`:

```ts
  | { type: 'setYearRange'; range: [number, number] }
  | { type: 'toggleCategory'; id: string }
  | { type: 'resetFilters' }
```

- [ ] **Step 4: Implement the cases**

Add to the `switch` in `heatMapReducer`, before `default`:

```ts
    case 'setYearRange': {
      // Normalize rather than trusting the caller: a dual-handle slider can
      // drag its low handle past its high one, and an inverted range would
      // silently select nothing.
      const [lo, hi] = action.range;
      const [minYear, maxYear] = state.yearBounds;
      const start = Math.max(minYear, Math.min(lo, hi));
      const end = Math.min(maxYear, Math.max(lo, hi));
      return { ...state, filters: { ...state.filters, yearRange: [start, end] } };
    }

    case 'toggleCategory': {
      const current = state.filters.categories;
      const next = current.includes(action.id)
        ? current.filter((id) => id !== action.id)
        : [...current, action.id];
      return { ...state, filters: { ...state.filters, categories: next } };
    }

    case 'resetFilters':
      if (state.filters === state.defaultFilters) return state;
      return { ...state, filters: state.defaultFilters };
```

- [ ] **Step 5: Seed the new state from the reconciled props**

In `src/components/CrimeHeatMap/CrimeHeatMap.tsx`, the store is created from
`reconciled`. Add the two new fields:

```tsx
  const [store] = useState(() => createHeatMapStore({
    level: reconciled.level,
    transform: { k: 1, x: 0, y: 0 },
    focusedCode: null,
    selectedCode: null,
    filters: reconciled.filters,
    // Same object, so `resetFilters` can compare by identity and no-op when
    // nothing has changed.
    defaultFilters: reconciled.filters,
    yearBounds: reconciled.yearBounds,
    metric: reconciled.metric,
    scaleMode,
  }));
```

- [ ] **Step 6: Return the bounds from reconciliation**

In `src/components/CrimeHeatMap/reconcile.ts`, add to `ReconcileResult`:

```ts
  /** The data's full year span, independent of the requested filter range. */
  yearBounds: [number, number];
```

and return it — `dataMin` and `dataMax` are already computed:

```ts
  return {
    filters: { yearRange, categories },
    yearBounds: [dataMin, dataMax],
    level, metric, warnings,
  };
```

- [ ] **Step 7: Cover the new field**

Add to `src/components/CrimeHeatMap/reconcile.test.ts`:

```ts
describe('reconcileProps — year bounds', () => {
  it('reports the data span regardless of the requested range', () => {
    const { yearBounds } = reconcileProps(
      { defaultFilters: { yearRange: [2020, 2021], categories: [] } },
      index,
    );
    expect(yearBounds).toEqual([2018, 2022]);
  });

  it('reports a usable span for an empty dataset', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    const [lo, hi] = reconcileProps({}, empty).yearBounds;
    expect(Number.isFinite(lo)).toBe(true);
    expect(lo).toBeLessThanOrEqual(hi);
  });
});
```

- [ ] **Step 8: Run everything and commit**

```bash
npx vitest run src/context src/components/CrimeHeatMap
npm run typecheck && npm run lint
```

Expected: PASS. Other test files construct `HeatMapState` fixtures too — the
type error tells you exactly which ones need the two new fields; add them
rather than loosening the type.

```bash
git add src/context src/components/CrimeHeatMap
git commit -m "feat(context): add year-range, category-toggle and reset actions"
```

---

## Task 2: Chip and IconButton primitives

Two small controls the filter bar and sidebar both need. Built first so neither
panel invents its own.

**Files:**
- Create: `src/components/primitives/Chip.tsx`
- Create: `src/components/primitives/Chip.module.css`
- Create: `src/components/primitives/IconButton.tsx`
- Create: `src/components/primitives/IconButton.module.css`
- Test: `src/components/primitives/Chip.test.tsx`
- Test: `src/components/primitives/IconButton.test.tsx`

**Interfaces:**
- Produces:
  - `Chip` — `(props: { label: string; selected: boolean; onToggle: () => void; color?: string | undefined; count?: string | undefined; highlighted?: boolean | undefined }) => JSX.Element`
  - `IconButton` — `(props: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean | undefined; className?: string | undefined }) => JSX.Element`

- [ ] **Step 1: Write the failing tests**

Create `src/components/primitives/Chip.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip.js';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Hırsızlık" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Hırsızlık/u })).toBeInTheDocument();
  });

  it('reports selection through aria-pressed, not colour alone', () => {
    const { rerender } = render(<Chip label="A" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<Chip label="A" selected onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<Chip label="A" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a count beside the label when given one', () => {
    render(<Chip label="A" selected={false} onToggle={() => {}} count="1.234" />);
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('carries its category colour as a swatch', () => {
    const { container } = render(
      <Chip label="A" selected={false} onToggle={() => {}} color="#ff0000" />,
    );
    const swatch = container.querySelector('[data-role="swatch"]') as HTMLElement;
    expect(swatch.style.background).toBe('rgb(255, 0, 0)');
  });

  it('renders no swatch when no colour is given', () => {
    const { container } = render(<Chip label="A" selected={false} onToggle={() => {}} />);
    expect(container.querySelector('[data-role="swatch"]')).toBeNull();
  });

  it('marks itself highlighted so a hovered pie slice can point at it', () => {
    const { container } = render(
      <Chip label="A" selected={false} onToggle={() => {}} highlighted />,
    );
    expect(container.querySelector('[data-highlighted="true"]')).not.toBeNull();
  });
});
```

Create `src/components/primitives/IconButton.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton.js';

describe('IconButton', () => {
  it('exposes its label as the accessible name, since the glyph is decorative', () => {
    render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(screen.getByRole('button', { name: 'Daralt' })).toBeInTheDocument();
  });

  it('hides the glyph from assistive technology', () => {
    const { container } = render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('«');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<IconButton label="Daralt" onClick={onClick}>«</IconButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports a toggle state when given one', () => {
    render(<IconButton label="Daralt" onClick={() => {}} pressed>«</IconButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits aria-pressed entirely when it is not a toggle', () => {
    render(<IconButton label="Daralt" onClick={() => {}}>«</IconButton>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/primitives`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `Chip`**

`src/components/primitives/Chip.module.css`:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--hm-glass-border);
  background: transparent;
  color: var(--hm-fg-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--hm-motion-hover) var(--hm-ease-hover),
              color var(--hm-motion-hover) var(--hm-ease-hover);
}

.chip:hover { color: var(--hm-fg); }

.chip[aria-pressed='true'] {
  background: rgba(255, 255, 255, 0.14);
  color: var(--hm-fg);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Driven by a hovered pie slice, so the link between the two reads instantly. */
.chip[data-highlighted='true'] {
  outline: 2px solid var(--hm-focus-ring);
  outline-offset: 1px;
}

.chip:focus-visible {
  outline: 2px solid var(--hm-focus-ring);
  outline-offset: 2px;
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: none;
}

.count {
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}
```

`src/components/primitives/Chip.tsx`:

```tsx
import styles from './Chip.module.css';

export interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** Category colour, shown as a swatch. Omit for a plain chip. */
  color?: string | undefined;
  /** Pre-formatted count. Colour is a summary; the number is the truth (§6.5). */
  count?: string | undefined;
  /** Set while the matching pie slice is hovered. */
  highlighted?: boolean | undefined;
}

/** A toggleable filter chip. */
export function Chip({ label, selected, onToggle, color, count, highlighted }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={selected}
      data-highlighted={highlighted === true ? 'true' : 'false'}
      onClick={onToggle}
    >
      {color === undefined ? null : (
        <span className={styles.swatch} data-role="swatch" style={{ background: color }} />
      )}
      <span>{label}</span>
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
    </button>
  );
}
```

- [ ] **Step 4: Implement `IconButton`**

`src/components/primitives/IconButton.module.css`:

```css
.button {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--hm-fg-muted);
  font: inherit;
  line-height: 1;
  cursor: pointer;
  transition: background var(--hm-motion-hover) var(--hm-ease-hover),
              color var(--hm-motion-hover) var(--hm-ease-hover);
}

.button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--hm-fg);
}

.button:focus-visible {
  outline: 2px solid var(--hm-focus-ring);
  outline-offset: 2px;
}

.button[aria-pressed='true'] {
  background: rgba(255, 255, 255, 0.14);
  color: var(--hm-fg);
}
```

`src/components/primitives/IconButton.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  /** Accessible name. The glyph itself is hidden from assistive tech. */
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Omit for a plain button; a boolean makes it a toggle. */
  pressed?: boolean | undefined;
  className?: string | undefined;
}

export function IconButton({ label, onClick, children, pressed, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={className === undefined ? styles.button! : `${styles.button!} ${className}`}
      aria-label={label}
      // aria-pressed on a non-toggle would announce a state that does not exist.
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
```

- [ ] **Step 5: Run the tests and commit**

Run: `npx vitest run src/components/primitives`
Expected: PASS — 7 Chip tests, 5 IconButton tests, 4 GlassPanel tests.

```bash
git add src/components/primitives
git commit -m "feat(ui): add Chip and IconButton primitives"
```

---

## Task 3: Linear scale and the dual-handle RangeSlider

The slider maps years to pixels and back. That mapping is arithmetic with edge
cases — a zero-width domain, a value outside the domain, a click exactly on a
handle — so it goes in `core/` where it is tested exhaustively, leaving the
component to handle only pointers and focus.

**Files:**
- Create: `src/core/chart/scale.ts`
- Create: `src/core/chart/index.ts`
- Create: `src/components/primitives/RangeSlider.tsx`
- Create: `src/components/primitives/RangeSlider.module.css`
- Test: `src/core/chart/scale.test.ts`
- Test: `src/components/primitives/RangeSlider.test.tsx`

**Interfaces:**
- Produces (pure):
  - `LinearScale` — `{ toRange(value: number): number; toDomain(position: number): number; domain: readonly [number, number]; range: readonly [number, number] }`
  - `createLinearScale(domain: readonly [number, number], range: readonly [number, number]): LinearScale`
  - `snapToStep(value: number, min: number, step: number): number`
- Produces (React): `RangeSlider` — `(props: { min: number; max: number; value: [number, number]; onChange: (range: [number, number]) => void; label: string; formatValue: (v: number) => string }) => JSX.Element`

- [ ] **Step 1: Write the failing scale test**

Create `src/core/chart/scale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLinearScale, snapToStep } from './scale.js';

describe('createLinearScale', () => {
  const scale = createLinearScale([2015, 2024], [0, 900]);

  it('maps the domain ends to the range ends', () => {
    expect(scale.toRange(2015)).toBe(0);
    expect(scale.toRange(2024)).toBe(900);
  });

  it('maps the midpoint proportionally', () => {
    expect(scale.toRange(2019.5)).toBeCloseTo(450);
  });

  it('inverts back to the domain', () => {
    expect(scale.toDomain(0)).toBe(2015);
    expect(scale.toDomain(900)).toBe(2024);
    expect(scale.toDomain(450)).toBeCloseTo(2019.5);
  });

  it('round-trips any value in the domain', () => {
    for (const year of [2015, 2018, 2021, 2024]) {
      expect(scale.toDomain(scale.toRange(year))).toBeCloseTo(year);
    }
  });

  it('clamps a value below the domain', () => {
    expect(scale.toRange(1900)).toBe(0);
  });

  it('clamps a value above the domain', () => {
    expect(scale.toRange(3000)).toBe(900);
  });

  it('clamps a position outside the range', () => {
    expect(scale.toDomain(-50)).toBe(2015);
    expect(scale.toDomain(9999)).toBe(2024);
  });

  it('collapses a zero-width domain to the range start rather than dividing by zero', () => {
    const flat = createLinearScale([2020, 2020], [0, 900]);
    expect(flat.toRange(2020)).toBe(0);
    expect(Number.isFinite(flat.toRange(2020))).toBe(true);
    expect(flat.toDomain(450)).toBe(2020);
  });

  it('handles an inverted range, so a scale can run bottom-up', () => {
    const inverted = createLinearScale([0, 100], [500, 0]);
    expect(inverted.toRange(0)).toBe(500);
    expect(inverted.toRange(100)).toBe(0);
    expect(inverted.toDomain(500)).toBe(0);
  });

  it('exposes its domain and range', () => {
    expect(scale.domain).toEqual([2015, 2024]);
    expect(scale.range).toEqual([0, 900]);
  });
});

describe('snapToStep', () => {
  it('snaps to the nearest step', () => {
    expect(snapToStep(2019.4, 2015, 1)).toBe(2019);
    expect(snapToStep(2019.6, 2015, 1)).toBe(2020);
  });

  it('is exact on a step boundary', () => {
    expect(snapToStep(2020, 2015, 1)).toBe(2020);
  });

  it('honours a step larger than one', () => {
    expect(snapToStep(2018, 2010, 5)).toBe(2020);
    expect(snapToStep(2012, 2010, 5)).toBe(2010);
  });

  it('returns the value unchanged for a non-positive step', () => {
    expect(snapToStep(2019.4, 2015, 0)).toBe(2019.4);
    expect(snapToStep(2019.4, 2015, -1)).toBe(2019.4);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/chart/scale.test.ts`
Expected: FAIL — cannot resolve `./scale.js`.

- [ ] **Step 3: Implement the scale**

`src/core/chart/scale.ts`:

```ts
export interface LinearScale {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  /** Domain value → range position. Clamped to the range. */
  toRange: (value: number) => number;
  /** Range position → domain value. Clamped to the domain. */
  toDomain: (position: number) => number;
}

function clamp(value: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (value < lo) return lo;
  return value > hi ? hi : value;
}

/**
 * A clamped linear mapping between a data domain and a pixel range.
 *
 * Both directions clamp. An unclamped scale is how a slider handle ends up
 * drawn outside its track and how a chart point lands off-canvas; there is no
 * caller here that wants extrapolation.
 *
 * A zero-width domain maps everything to the range start rather than dividing
 * by zero — a dataset covering a single year is ordinary, not exceptional.
 */
export function createLinearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  return {
    domain,
    range,
    toRange: (value) => (
      span === 0 ? r0 : clamp(r0 + ((value - d0) / span) * (r1 - r0), r0, r1)
    ),
    toDomain: (position) => (
      r1 - r0 === 0 || span === 0
        ? d0
        : clamp(d0 + ((position - r0) / (r1 - r0)) * span, d0, d1)
    ),
  };
}

/** Rounds to the nearest `min + n * step`. A non-positive step is a no-op. */
export function snapToStep(value: number, min: number, step: number): number {
  if (step <= 0) return value;
  return min + Math.round((value - min) / step) * step;
}
```

- [ ] **Step 4: Run the scale test and check coverage**

```bash
npx vitest run src/core/chart/scale.test.ts
npx vitest run --coverage
```

Expected: PASS, and `scale.ts` at 100% on all four columns.

- [ ] **Step 5: Write the barrel**

`src/core/chart/index.ts`:

```ts
export type { LinearScale } from './scale.js';
export { createLinearScale, snapToStep } from './scale.js';
```

- [ ] **Step 6: Write the failing slider test**

Create `src/components/primitives/RangeSlider.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangeSlider } from './RangeSlider.js';

const TRACK_WIDTH = 900;

function renderSlider(value: [number, number] = [2015, 2024], onChange = vi.fn()) {
  const utils = render(
    <RangeSlider
      min={2015}
      max={2024}
      value={value}
      onChange={onChange}
      label="Yıl aralığı"
      formatValue={(v) => String(v)}
    />,
  );
  const track = utils.container.querySelector('[data-role="track"]') as HTMLElement;
  // jsdom gives every element a zero-width rect; the slider reads the track to
  // convert pointer x into a year, so give it a real one.
  track.getBoundingClientRect = () => ({
    left: 0, top: 0, right: TRACK_WIDTH, bottom: 20,
    width: TRACK_WIDTH, height: 20, x: 0, y: 0, toJSON: () => ({}),
  });
  return { ...utils, track, onChange };
}

describe('RangeSlider', () => {
  it('exposes both handles as sliders with their values', () => {
    renderSlider([2018, 2021]);
    const handles = screen.getAllByRole('slider');
    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute('aria-valuenow', '2018');
    expect(handles[1]).toHaveAttribute('aria-valuenow', '2021');
  });

  it('bounds each handle by the other, so they cannot cross', () => {
    renderSlider([2018, 2021]);
    const [low, high] = screen.getAllByRole('slider');
    expect(low).toHaveAttribute('aria-valuemin', '2015');
    expect(low).toHaveAttribute('aria-valuemax', '2021');
    expect(high).toHaveAttribute('aria-valuemin', '2018');
    expect(high).toHaveAttribute('aria-valuemax', '2024');
  });

  it('moves the low handle right on ArrowRight', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([2019, 2021]);
  });

  it('moves the low handle left on ArrowLeft', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith([2017, 2021]);
  });

  it('does not let the low handle pass the high one', () => {
    const { onChange } = renderSlider([2021, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('jumps to the ends on Home and End', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith([2015, 2021]);

    fireEvent.keyDown(screen.getAllByRole('slider')[1]!, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('ignores an unrelated key', () => {
    const { onChange } = renderSlider([2018, 2021]);
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'q' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps a pointer drag to whole years', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0 });
    // One third across a 9-year span is 2018.
    fireEvent.pointerMove(track, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).toHaveBeenCalledWith([2018, 2024]);
  });

  it('ignores pointer movement when no handle is being dragged', () => {
    const { track, onChange } = renderSlider();
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops dragging on pointer up', () => {
    const { track, onChange } = renderSlider([2015, 2024]);
    const [low] = screen.getAllByRole('slider');

    fireEvent.pointerDown(low!, { pointerId: 1, clientX: 0 });
    fireEvent.pointerUp(track, { pointerId: 1 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: TRACK_WIDTH / 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('labels the group for screen readers', () => {
    renderSlider();
    expect(screen.getByRole('group', { name: 'Yıl aralığı' })).toBeInTheDocument();
  });

  it('shows the formatted endpoints', () => {
    renderSlider([2018, 2021]);
    expect(screen.getByText('2018')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Implement the slider**

`src/components/primitives/RangeSlider.module.css`:

```css
.wrapper { display: grid; gap: 4px; }

.readout {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--hm-fg-muted);
  font-variant-numeric: tabular-nums;
}

.track {
  position: relative;
  height: 20px;
  cursor: pointer;
  touch-action: none;
}

.rail,
.fill {
  position: absolute;
  top: 9px;
  height: 3px;
  border-radius: 2px;
}

.rail { left: 0; right: 0; background: rgba(255, 255, 255, 0.16); }
.fill { background: var(--hm-fg); opacity: 0.7; }

.handle {
  position: absolute;
  top: 3px;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--hm-map-bg);
  background: var(--hm-fg);
  cursor: grab;
}

.handle:focus-visible {
  outline: 2px solid var(--hm-focus-ring);
  outline-offset: 2px;
}
```

`src/components/primitives/RangeSlider.tsx`:

```tsx
import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createLinearScale, snapToStep } from '@/core/chart/index.js';
import styles from './RangeSlider.module.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  /** Accessible name for the pair. */
  label: string;
  formatValue: (value: number) => string;
}

type Handle = 'low' | 'high';

/**
 * Dual-handle range slider over a discrete domain.
 *
 * Each handle is a real `role="slider"` with its own bounds, so the pair is
 * fully keyboard-operable and screen readers announce which end is moving.
 * The handles bound each other rather than being allowed to cross and swap —
 * swapping mid-drag makes the control feel like it slipped out of your hand.
 */
export function RangeSlider({
  min, max, value, onChange, label, formatValue,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [low, high] = value;

  const percent = (v: number): number => {
    const scale = createLinearScale([min, max], [0, 100]);
    return scale.toRange(v);
  };

  const emit = useCallback((handle: Handle, next: number) => {
    if (handle === 'low') {
      const clamped = Math.min(Math.max(next, min), high);
      if (clamped !== low) onChange([clamped, high]);
      return;
    }
    const clamped = Math.max(Math.min(next, max), low);
    if (clamped !== high) onChange([low, clamped]);
  }, [low, high, min, max, onChange]);

  const onKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: Handle,
  ) => {
    const current = handle === 'low' ? low : high;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        emit(handle, current + 1);
        return;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        emit(handle, current - 1);
        return;
      case 'Home':
        event.preventDefault();
        emit(handle, min);
        return;
      case 'End':
        event.preventDefault();
        emit(handle, max);
        return;
      default:
    }
  }, [low, high, min, max, emit]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (dragging === null || track === null) return;

    const rect = track.getBoundingClientRect();
    const scale = createLinearScale([min, max], [rect.left, rect.right]);
    emit(dragging, snapToStep(scale.toDomain(event.clientX), min, 1));
  }, [dragging, min, max, emit]);

  const handleProps = (handle: Handle) => ({
    type: 'button' as const,
    role: 'slider',
    className: styles.handle,
    'aria-label': label,
    'aria-valuenow': handle === 'low' ? low : high,
    'aria-valuemin': handle === 'low' ? min : low,
    'aria-valuemax': handle === 'low' ? high : max,
    'aria-valuetext': formatValue(handle === 'low' ? low : high),
    style: { left: `${percent(handle === 'low' ? low : high)}%` },
    onPointerDown: () => { setDragging(handle); },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => { onKeyDown(event, handle); },
  });

  return (
    <div className={styles.wrapper} role="group" aria-label={label}>
      <div className={styles.readout}>
        <span>{formatValue(low)}</span>
        <span>{formatValue(high)}</span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        data-role="track"
        onPointerMove={onPointerMove}
        onPointerUp={() => { setDragging(null); }}
        onPointerLeave={() => { setDragging(null); }}
      >
        <span className={styles.rail} />
        <span
          className={styles.fill}
          style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
        />
        <button {...handleProps('low')} />
        <button {...handleProps('high')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run the tests and commit**

Run: `npx vitest run src/core/chart src/components/primitives`
Expected: PASS — 14 scale tests, 12 slider tests, plus the earlier primitives.

```bash
git add src/core/chart src/components/primitives
git commit -m "feat(ui): add clamped linear scale and dual-handle range slider"
```

---

## Task 4: FilterBar

Year range, category chips and `Sıfırla`, plus the per-capita toggle when the
consumer supplied population.

**Files:**
- Create: `src/components/FilterBar/FilterBar.tsx`
- Create: `src/components/FilterBar/FilterBar.module.css`
- Create: `src/components/FilterBar/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`
- Test: `src/components/FilterBar/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `useHeatMapState`, `useHeatMapDispatch`, `useStrings`; `Chip`, `IconButton`, `RangeSlider`; `formatTrNumber`.
- Produces: `FilterBar` — `(props: { categories: readonly CrimeCategory[]; categoryTotals: ReadonlyMap<string, number>; hasPopulation: boolean; highlightedCategory: string | null }) => JSX.Element`
- Produces, added to `Strings`:
  ```ts
  filters: {
    title: string; yearRange: string; categories: string;
    reset: string; perCapita: string; allCategories: string;
  };
  ```

- [ ] **Step 1: Add the strings**

In `src/i18n/types.ts`, add to `Strings`:

```ts
  filters: {
    title: string;
    yearRange: string;
    categories: string;
    reset: string;
    perCapita: string;
    /** Shown when no category chip is selected. */
    allCategories: string;
  };
```

In `src/i18n/tr.ts`, add the matching group:

```ts
  filters: {
    title: 'Filtreler',
    yearRange: 'Yıl aralığı',
    categories: 'Suç türü',
    reset: 'Sıfırla',
    perCapita: 'Nüfusa göre',
    allCategories: 'Tümü',
  },
```

`mergeStrings` lists its groups explicitly, so add `filters: mergeGroup('filters', overrides),`
to `src/i18n/index.ts` — TypeScript will flag it as missing until you do.

- [ ] **Step 2: Write the failing test**

Create `src/components/FilterBar/FilterBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { FilterBar } from './FilterBar.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const TOTALS = new Map([['hirsizlik', 1200], ['darp', 340]]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  metric: 'total',
  scaleMode: 'quantile',
};

function renderBar(state: HeatMapState = base, props: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <FilterBar
      categories={CATEGORIES}
      categoryTotals={TOTALS}
      hasPopulation={false}
      highlightedCategory={null}
      {...props}
    />,
    { wrapper },
  );
  return { ...utils, store };
}

describe('FilterBar', () => {
  it('is labelled as a group', () => {
    renderBar();
    expect(screen.getByRole('group', { name: trStrings.filters.title })).toBeInTheDocument();
  });

  it('renders a chip per category', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /Hırsızlık/u })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Darp/u })).toBeInTheDocument();
  });

  it('shows each category total beside its chip', () => {
    renderBar();
    expect(screen.getByText('1.200')).toBeInTheDocument();
  });

  it('toggles a category into the filter set', () => {
    const { store } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Hırsızlık/u }));
    expect(store.getState().filters.categories).toEqual(['hirsizlik']);
  });

  it('toggles a category back out', () => {
    const selected: HeatMapState = {
      ...base,
      filters: { yearRange: [2015, 2024], categories: ['hirsizlik'] },
    };
    const { store } = renderBar(selected);
    fireEvent.click(screen.getByRole('button', { name: /Hırsızlık/u }));
    expect(store.getState().filters.categories).toEqual([]);
  });

  it('marks a selected chip pressed', () => {
    const selected: HeatMapState = {
      ...base,
      filters: { yearRange: [2015, 2024], categories: ['darp'] },
    };
    renderBar(selected);
    expect(screen.getByRole('button', { name: /Darp/u })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says "all" when nothing is selected, since empty means every category', () => {
    renderBar();
    expect(screen.getByText(trStrings.filters.allCategories)).toBeInTheDocument();
  });

  it('resets filters to the defaults', () => {
    const dirty: HeatMapState = {
      ...base,
      filters: { yearRange: [2018, 2019], categories: ['darp'] },
    };
    const { store } = renderBar(dirty);
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.reset }));
    expect(store.getState().filters).toEqual(base.defaultFilters);
  });

  it('exposes the year range as two sliders', () => {
    renderBar();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('writes a keyboard year change into the store', () => {
    const { store } = renderBar();
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(store.getState().filters.yearRange).toEqual([2016, 2024]);
  });

  it('does not render the per-capita toggle without population data', () => {
    renderBar();
    expect(screen.queryByRole('button', { name: trStrings.filters.perCapita }))
      .not.toBeInTheDocument();
  });

  it('renders the per-capita toggle when population is supplied', () => {
    renderBar(base, { hasPopulation: true });
    expect(screen.getByRole('button', { name: trStrings.filters.perCapita }))
      .toBeInTheDocument();
  });

  it('switches the metric through the toggle', () => {
    const { store } = renderBar(base, { hasPopulation: true });
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.perCapita }));
    expect(store.getState().metric).toBe('perCapita');
  });

  it('highlights the chip matching a hovered pie slice', () => {
    const { container } = renderBar(base, { highlightedCategory: 'darp' });
    const highlighted = container.querySelectorAll('[data-highlighted="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.textContent).toContain('Darp');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/components/FilterBar`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `FilterBar`**

`src/components/FilterBar/FilterBar.module.css`:

```css
.bar { padding: 10px 12px; display: grid; gap: 10px; min-width: 260px; }

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.title { margin: 0; font-size: 12px; font-weight: 600; color: var(--hm-fg); }

.reset {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--hm-glass-border);
  background: transparent;
  color: var(--hm-fg-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.reset:hover { color: var(--hm-fg); }
.reset:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 2px; }

.section { display: grid; gap: 5px; }
.sectionLabel { font-size: 11px; color: var(--hm-fg-muted); }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.perCapita { justify-self: start; }
```

`src/components/FilterBar/FilterBar.tsx`:

```tsx
import { useCallback } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { Chip } from '@/components/primitives/Chip.js';
import { IconButton } from '@/components/primitives/IconButton.js';
import { RangeSlider } from '@/components/primitives/RangeSlider.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  categories: readonly CrimeCategory[];
  /** Total per category for the active filters, shown on each chip. */
  categoryTotals: ReadonlyMap<string, number>;
  /** Controls whether the per-capita toggle exists at all (§6.6). */
  hasPopulation: boolean;
  /** Category whose pie slice is currently hovered, or null. */
  highlightedCategory: string | null;
}

export function FilterBar({
  categories, categoryTotals, hasPopulation, highlightedCategory,
}: FilterBarProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const filters = useHeatMapState((state) => state.filters);
  const yearBounds = useHeatMapState((state) => state.yearBounds);
  const metric = useHeatMapState((state) => state.metric);

  const onYearChange = useCallback((range: [number, number]) => {
    dispatch({ type: 'setYearRange', range });
  }, [dispatch]);

  const selected = new Set(filters.categories);

  return (
    <GlassPanel label={strings.filters.title} className={styles.bar}>
      <div className={styles.header}>
        <h2 className={styles.title}>{strings.filters.title}</h2>
        <button
          type="button"
          className={styles.reset}
          onClick={() => { dispatch({ type: 'resetFilters' }); }}
        >
          {strings.filters.reset}
        </button>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>{strings.filters.yearRange}</span>
        <RangeSlider
          min={yearBounds[0]}
          max={yearBounds[1]}
          value={filters.yearRange}
          onChange={onYearChange}
          label={strings.filters.yearRange}
          formatValue={String}
        />
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          {strings.filters.categories}
          {/* An empty selection means every category, not none — say so, because
              a bar of unpressed chips otherwise reads as "nothing selected". */}
          {selected.size === 0 ? ` · ${strings.filters.allCategories}` : ''}
        </span>
        <div className={styles.chips}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              selected={selected.has(category.id)}
              highlighted={category.id === highlightedCategory}
              {...(category.color === undefined ? {} : { color: category.color })}
              count={formatTrNumber(categoryTotals.get(category.id) ?? 0)}
              onToggle={() => { dispatch({ type: 'toggleCategory', id: category.id }); }}
            />
          ))}
        </div>
      </div>

      {hasPopulation ? (
        <IconButton
          label={strings.filters.perCapita}
          className={styles.perCapita}
          pressed={metric === 'perCapita'}
          onClick={() => {
            dispatch({
              type: 'setMetric',
              metric: metric === 'perCapita' ? 'total' : 'perCapita',
            });
          }}
        >
          ⌀
        </IconButton>
      ) : null}
    </GlassPanel>
  );
}
```

- [ ] **Step 5: Write the barrel**

`src/components/FilterBar/index.ts`:

```ts
export type { FilterBarProps } from './FilterBar.js';
export { FilterBar } from './FilterBar.js';
```

- [ ] **Step 6: Run the tests and commit**

```bash
npx vitest run src/components/FilterBar src/i18n
npm run typecheck && npm run lint
```

Expected: PASS, 14 FilterBar tests.

```bash
git add src/components/FilterBar src/i18n
git commit -m "feat(filters): add filter bar with year range, chips and reset"
```

---

**Part 1 ends here.** Tasks 5–7 (search and sidebar) are in
`docs/superpowers/plans/2026-08-01-phase-3-panels-part-2.md`.
Tasks 8–11 (charts, layout, panel matrix, exit checks) are in
`docs/superpowers/plans/2026-08-01-phase-3-panels-part-3.md`.
