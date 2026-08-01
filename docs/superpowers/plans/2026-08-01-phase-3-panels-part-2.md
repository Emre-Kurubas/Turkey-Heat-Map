# Türkiye Suç Haritası — Phase 3: Panels (Part 2 — Search and Sidebar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Continues `docs/superpowers/plans/2026-08-01-phase-3-panels.md`. The Global
Constraints in that document apply to every task here. Tasks 1–4 are complete
before starting Task 5.

---

## Task 5: Cross-panel wiring — fly-to requests and hover source

Two couplings have to exist before the sidebar or the search bar can work, and
neither may be a direct dependency: **no panel imports another** (§7.8).

Both are solved the same way — through the stores, which every panel already
subscribes to and which the map (always mounted) can act on.

**Files:**
- Modify: `src/context/HeatMapStore.ts`, `src/context/HeatMapStore.test.ts`
- Modify: `src/context/HoverStore.ts`
- Modify: `src/components/MapCanvas/MapCanvas.tsx`
- Modify: `src/components/MapCanvas/HitLayer.tsx`
- Modify: `src/components/MapCanvas/MapCanvas.test.tsx`

**Interfaces:**
- Produces, added to `HeatMapAction`:
  - `{ type: 'requestFlyTo'; code: string }`
  - `{ type: 'clearFlyTo' }`
- Produces, added to `HeatMapState`:
  - `flyToRequest: string | null` — a region code the map should fly to, or null
- Produces, changed on `HoverTarget`:
  - `source: 'map' | 'list'` — where the hover came from

- [x] **Step 1: Write the failing store tests**

Add to `src/context/HeatMapStore.test.ts`:

```ts
describe('fly-to requests', () => {
  it('records a requested region', () => {
    const next = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(next.flyToRequest).toBe('34');
  });

  it('clears the request once the map has acted on it', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(heatMapReducer(asked, { type: 'clearFlyTo' }).flyToRequest).toBeNull();
  });

  it('no-ops when clearing an already-empty request', () => {
    expect(heatMapReducer(base, { type: 'clearFlyTo' })).toBe(base);
  });

  it('re-requesting the same region still fires, so a second click flies again', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    const again = heatMapReducer(asked, { type: 'requestFlyTo', code: '34' });
    expect(again).not.toBe(asked);
    expect(again.flyToRequest).toBe('34');
  });

  it('drops a pending request when the level changes, since codes are level-specific', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(heatMapReducer(asked, { type: 'setLevel', level: 'ilce' }).flyToRequest).toBeNull();
  });
});
```

Add `flyToRequest: null` to the shared `base` fixture.

- [x] **Step 2: Implement the store changes**

In `src/context/HeatMapStore.ts`, add to `HeatMapState`:

```ts
  /**
   * A region the map has been asked to fly to, by a panel that cannot reach
   * the map directly. The map clears it once the animation starts.
   */
  flyToRequest: string | null;
```

to `HeatMapAction`:

```ts
  | { type: 'requestFlyTo'; code: string }
  | { type: 'clearFlyTo' }
```

and to the reducer, before `default`:

```ts
    case 'requestFlyTo':
      // Always a new object, even for the same code: clicking the same sidebar
      // row twice should fly twice, and identity is how the map notices.
      return { ...state, flyToRequest: action.code };

    case 'clearFlyTo':
      return state.flyToRequest === null ? state : { ...state, flyToRequest: null };
```

Extend the existing `setLevel` case to drop the request — a pending `'34'`
means nothing once districts are the active level:

```ts
    case 'setLevel':
      if (action.level === state.level) return state;
      return {
        ...state,
        level: action.level,
        selectedCode: null,
        focusedCode: null,
        flyToRequest: null,
      };
```

- [x] **Step 3: Tag hover targets with their source**

In `src/context/HoverStore.ts`, extend `HoverTarget`:

```ts
export interface HoverTarget {
  code: string;
  /** Client coordinates, for tooltip placement. Zero for a list hover. */
  x: number;
  y: number;
  /**
   * Where the hover came from. A list hover highlights the region on the map
   * but must not open a tooltip — there is no pointer over the map to anchor
   * it to, and one would appear in the corner attached to nothing.
   */
  source: 'map' | 'list';
}
```

- [x] **Step 4: Make the map honour the fly-to request**

In `src/components/MapCanvas/MapCanvas.tsx`, add the effect. `useFlyTo` and
`geometry.bounds` are both already available here:

```tsx
  const flyTo = useFlyTo(viewport);
  const flyToRequest = useHeatMapState((state) => state.flyToRequest);

  // Panels ask for a fly-to through the store rather than reaching into the
  // map. The request is cleared immediately so the same region can be
  // requested again.
  useEffect(() => {
    if (flyToRequest === null) return;

    const bbox = geometry.bounds.get(flyToRequest);
    if (bbox !== undefined) flyTo(bbox);
    dispatch({ type: 'clearFlyTo' });
  }, [flyToRequest, geometry.bounds, flyTo, dispatch]);
```

Add `useEffect` to the React import and
`import { useFlyTo } from '@/hooks/useFlyTo.js';`.

- [x] **Step 5: Tag the map's own hovers**

In `src/components/MapCanvas/HitLayer.tsx`, both `setHover` calls need the new
field:

```tsx
    setHover({ type: 'enter', target: { code, x: event.clientX, y: event.clientY, source: 'map' } });
```

The `move` action carries no source, so it needs no change.

- [x] **Step 6: Make the tooltip ignore list hovers**

In `src/components/HoverTooltip/HoverTooltip.tsx`, the effect that shows the
tooltip becomes:

```tsx
  const hoveredCode = hover?.code ?? null;
  // A list hover highlights the map region but must not open a tooltip.
  const fromMap = hover?.source === 'map';

  useEffect(() => {
    if (hoveredCode === null || !fromMap) { setVisible(false); return; }

    const timer = setTimeout(() => { setVisible(true); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [hoveredCode, fromMap, delayMs]);
```

- [x] **Step 7: Cover the map's half of the wiring**

Add to `src/components/MapCanvas/MapCanvas.test.tsx`:

```tsx
  it('flies to a region requested through the store', () => {
    const { store } = renderCanvas();
    const before = store.getState().transform;

    act(() => { store.dispatch({ type: 'requestFlyTo', code: '34' }); });
    expect(store.getState().transform).not.toEqual(before);
  });

  it('clears the request so the same region can be requested again', () => {
    const { store } = renderCanvas();
    act(() => { store.dispatch({ type: 'requestFlyTo', code: '34' }); });
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('ignores a request for a region it has no geometry for', () => {
    const { store } = renderCanvas();
    const before = store.getState().transform;

    act(() => { store.dispatch({ type: 'requestFlyTo', code: 'yok' }); });
    expect(store.getState().transform).toEqual(before);
    expect(store.getState().flyToRequest).toBeNull();
  });
```

Import `act` from `@testing-library/react`, and stub `matchMedia` to report
reduced motion in this file so the fly-to lands in one step rather than needing
animation frames:

```tsx
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });
```

- [x] **Step 8: Run everything and commit**

```bash
npx vitest run src/context src/components/MapCanvas src/components/HoverTooltip
npm run typecheck && npm run lint
```

Existing `HoverTarget` fixtures will fail to typecheck until they carry
`source`. Add `source: 'map'` to each — the compiler lists them.

```bash
git add src/context src/components/MapCanvas src/components/HoverTooltip
git commit -m "feat(context): route fly-to requests and hover source through the stores"
```

---

## Task 6: SearchBar

One input over four entity types, Turkish-aware, fully keyboard-driven.
Selecting a place flies the map; selecting a category or year applies a filter.

**Files:**
- Create: `src/hooks/useSearchIndex.ts`
- Create: `src/components/SearchBar/SearchBar.tsx`
- Create: `src/components/SearchBar/SearchBar.module.css`
- Create: `src/components/SearchBar/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`, `src/i18n/index.ts`
- Test: `src/hooks/useSearchIndex.test.tsx`
- Test: `src/components/SearchBar/SearchBar.test.tsx`

**Interfaces:**
- Consumes: `buildSearchIndex`, `searchEntities`, `SearchEntity`, `SearchResult` from `core/search`; `IL_REGIONS`, `getLevelRegionMeta`.
- Produces:
  - `useSearchIndex(categories: readonly CrimeCategory[], years: readonly number[]): SearchEntity[]`
  - `SearchBar` — `(props: { categories: readonly CrimeCategory[] }) => JSX.Element`
- Produces, added to `Strings`:
  ```ts
  search: {
    label: string; placeholder: string; noResults: string;
    groups: { il: string; ilce: string; category: string; year: string };
  };
  ```

- [x] **Step 1: Add the strings**

`src/i18n/types.ts`:

```ts
  search: {
    label: string;
    placeholder: string;
    noResults: string;
    /** Dropdown group headings, keyed by SearchEntityType. */
    groups: { il: string; ilce: string; category: string; year: string };
  };
```

`src/i18n/tr.ts`:

```ts
  search: {
    label: 'Ara',
    placeholder: 'İl, ilçe, suç türü veya yıl ara…',
    noResults: 'Sonuç bulunamadı',
    groups: { il: 'İl', ilce: 'İlçe', category: 'Suç Türü', year: 'Yıl' },
  },
```

Add `search: mergeGroup('search', overrides),` to `src/i18n/index.ts`.

**Note:** `mergeGroup` merges one level. `search.groups` is a nested object, so
overriding `search` replaces `groups` wholesale rather than merging into it.
That is acceptable and consistent with every other group; document it by
leaving the existing `mergeStrings` doc comment as-is.

- [x] **Step 2: Write the failing index test**

Create `src/hooks/useSearchIndex.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CrimeCategory } from '@/core/types/index.js';
import { useSearchIndex } from './useSearchIndex.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const YEARS = [2020, 2021];

describe('useSearchIndex', () => {
  it('indexes every province', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'il')).toHaveLength(81);
  });

  it('indexes every district', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'ilce')).toHaveLength(973);
  });

  it('indexes the categories and years given to it', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'category')).toHaveLength(1);
    expect(result.current.filter((e) => e.type === 'year')).toHaveLength(2);
  });

  it('names the parent province of each district, so duplicates are tellable apart', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    const adalar = result.current.find((e) => e.type === 'ilce' && e.id === '3401');
    expect(adalar?.parentLabel).toBe('İstanbul');
  });

  it('is stable across renders with the same inputs', () => {
    const { result, rerender } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
```

- [x] **Step 3: Implement `useSearchIndex`**

```ts
import { useMemo } from 'react';
import { buildSearchIndex, type SearchEntity } from '@/core/search/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { IL_REGIONS, getLevelRegionMeta } from '@/data/geo/index.js';

/**
 * The flat entity list the search bar matches against.
 *
 * Built from the shipped geography rather than the dataset, so a province with
 * no records is still findable — searching for a place and being told it does
 * not exist is a worse answer than finding it and seeing zero.
 */
export function useSearchIndex(
  categories: readonly CrimeCategory[],
  years: readonly number[],
): SearchEntity[] {
  return useMemo(() => {
    const ilNames = new Map(IL_REGIONS.map((region) => [region.code, region.name]));
    return buildSearchIndex({
      ilRegions: IL_REGIONS,
      ilceRegions: [...getLevelRegionMeta('ilce').values()],
      categories,
      years,
      ilNames,
    });
  }, [categories, years]);
}
```

- [x] **Step 4: Run the index test**

Run: `npx vitest run src/hooks/useSearchIndex.test.tsx`
Expected: PASS, 5 tests.

- [x] **Step 5: Write the failing SearchBar test**

Create `src/components/SearchBar/SearchBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { SearchBar } from './SearchBar.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

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

function renderSearch(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<SearchBar categories={CATEGORIES} />, { wrapper });
  const input = screen.getByRole('combobox');
  return { ...utils, store, input };
}

describe('SearchBar', () => {
  it('renders a labelled combobox', () => {
    renderSearch();
    expect(screen.getByRole('combobox', { name: trStrings.search.label })).toBeInTheDocument();
  });

  it('shows no dropdown until something is typed', () => {
    renderSearch();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  /** The İ/I trap: naive toLowerCase breaks this pair. */
  it('finds İstanbul from an undotted, unaccented query', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'istanbul' } });
    expect(screen.getByRole('option', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('finds Şişli from "sisli"', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'sisli' } });
    expect(screen.getByRole('option', { name: /Şişli/u })).toBeInTheDocument();
  });

  it('finds Ağrı from "agri"', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'agri' } });
    expect(screen.getByRole('option', { name: /Ağrı/u })).toBeInTheDocument();
  });

  it('groups results by entity type', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: '2020' } });
    expect(screen.getByText(trStrings.search.groups.year)).toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'zzzzqqq' } });
    expect(screen.getByText(trStrings.search.noResults)).toBeInTheDocument();
  });

  it('requests a fly-to when a province is chosen', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.click(screen.getByRole('option', { name: /Ankara/u }));
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('applies a category as a filter rather than flying anywhere', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'hirsizlik' } });
    fireEvent.click(screen.getByRole('option', { name: /Hırsızlık/u }));
    expect(store.getState().filters.categories).toEqual(['hirsizlik']);
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('applies a year as a single-year range', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: '2020' } });
    fireEvent.click(screen.getByRole('option', { name: '2020' }));
    expect(store.getState().filters.yearRange).toEqual([2020, 2020]);
  });

  it('moves the active option with the arrow keys', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'an' } });

    const first = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first);
  });

  it('selects the active option on Enter', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('closes the dropdown on Escape without clearing the query', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('ankara');
  });

  it('clears the query after a selection, so the dropdown does not linger', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect((input as HTMLInputElement).value).toBe('');
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('does nothing on Enter with no results', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'zzzzqqq' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('shows the parent province beside a district, since names repeat', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'yenisehir' } });
    // Yenişehir occurs three times; the parent is what tells them apart.
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    expect(screen.getAllByRole('option')[0]?.textContent).toMatch(/·/u);
  });
});
```

- [x] **Step 6: Implement `SearchBar`**

`src/components/SearchBar/SearchBar.module.css`:

```css
.wrapper { position: relative; min-width: 260px; }

.input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid var(--hm-glass-border);
  background: rgba(0, 0, 0, 0.25);
  color: var(--hm-fg);
  font: inherit;
  font-size: 13px;
}

.input::placeholder { color: var(--hm-fg-muted); }
.input:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: 1px; }

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  margin: 0;
  list-style: none;
  border-radius: 12px;
  background: var(--hm-glass-bg-solid);
  border: 1px solid var(--hm-glass-border);
  box-shadow: var(--hm-glass-shadow);
  z-index: 20;
}

.group {
  padding: 6px 8px 2px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hm-fg-muted);
}

.option {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--hm-fg);
  cursor: pointer;
}

.option[aria-selected='true'] { background: rgba(255, 255, 255, 0.14); }
.parent { color: var(--hm-fg-muted); font-size: 11px; }
.empty { padding: 10px; font-size: 12px; color: var(--hm-fg-muted); }
```

`src/components/SearchBar/SearchBar.tsx`:

```tsx
import { useCallback, useId, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { searchEntities, type SearchEntity, type SearchEntityType } from '@/core/search/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useHeatMapDispatch, useStrings } from '@/hooks/useHeatMapState.js';
import { useHeatMapState } from '@/hooks/useHeatMapState.js';
import { useSearchIndex } from '@/hooks/useSearchIndex.js';
import styles from './SearchBar.module.css';

const MAX_RESULTS = 12;
/** Dropdown group order. Places first: they are what people search for most. */
const GROUP_ORDER: readonly SearchEntityType[] = ['il', 'ilce', 'category', 'year'];

export interface SearchBarProps {
  categories: readonly CrimeCategory[];
}

export function SearchBar({ categories }: SearchBarProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const yearBounds = useHeatMapState((state) => state.yearBounds);

  const years = useMemo(() => {
    const [lo, hi] = yearBounds;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [yearBounds]);

  const index = useSearchIndex(categories, years);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const results = useMemo(
    () => (query.trim() === '' ? [] : searchEntities(index, query, MAX_RESULTS)),
    [index, query],
  );

  // Grouped for display, but the flat order is what the arrow keys walk, so the
  // two must agree — hence one sort feeding both.
  const ordered = useMemo(() => (
    [...results].sort((a, b) => {
      const group = GROUP_ORDER.indexOf(a.entity.type) - GROUP_ORDER.indexOf(b.entity.type);
      return group !== 0 ? group : b.score - a.score;
    })
  ), [results]);

  const select = useCallback((entity: SearchEntity) => {
    switch (entity.type) {
      case 'il':
      case 'ilce':
        dispatch({ type: 'requestFlyTo', code: entity.id });
        break;
      case 'category':
        dispatch({ type: 'toggleCategory', id: entity.id });
        break;
      case 'year': {
        const year = Number(entity.id);
        dispatch({ type: 'setYearRange', range: [year, year] });
        break;
      }
      default:
    }
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  }, [dispatch]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, ordered.length - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      case 'Enter': {
        const chosen = ordered[activeIndex];
        if (chosen !== undefined) { event.preventDefault(); select(chosen.entity); }
        return;
      }
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        return;
      default:
    }
  }, [ordered, activeIndex, select]);

  const showDropdown = open && query.trim() !== '';
  let flatIndex = -1;

  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        role="combobox"
        className={styles.input}
        aria-label={strings.search.label}
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        {...(showDropdown && ordered.length > 0
          ? { 'aria-activedescendant': `${listId}-${activeIndex}` }
          : {})}
        placeholder={strings.search.placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {showDropdown ? (
        <ul className={styles.dropdown} id={listId} role="listbox">
          {ordered.length === 0 ? (
            <li className={styles.empty}>{strings.search.noResults}</li>
          ) : GROUP_ORDER.map((type) => {
            const group = ordered.filter((result) => result.entity.type === type);
            if (group.length === 0) return null;

            return (
              <li key={type}>
                <div className={styles.group}>{strings.search.groups[type]}</div>
                <ul role="group" aria-label={strings.search.groups[type]}>
                  {group.map((result) => {
                    flatIndex += 1;
                    const position = flatIndex;
                    return (
                      <li
                        key={`${result.entity.type}-${result.entity.id}`}
                        id={`${listId}-${position}`}
                        role="option"
                        aria-selected={position === activeIndex}
                        className={styles.option}
                        onMouseDown={(event) => {
                          // mousedown, not click: blurring the input first would
                          // close the dropdown before the click landed.
                          event.preventDefault();
                          select(result.entity);
                        }}
                      >
                        <span>{result.entity.label}</span>
                        {result.entity.parentLabel === null ? null : (
                          <span className={styles.parent}>· {result.entity.parentLabel}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
```

- [x] **Step 7: Write the barrel, run and commit**

`src/components/SearchBar/index.ts`:

```ts
export type { SearchBarProps } from './SearchBar.js';
export { SearchBar } from './SearchBar.js';
```

```bash
npx vitest run src/components/SearchBar src/hooks/useSearchIndex.test.tsx
npm run typecheck && npm run lint
```

Expected: PASS, 16 SearchBar tests + 5 index tests.

If the click tests fail because the option never fires, check that the handler
is `onMouseDown` with `preventDefault` — `onClick` fires after blur, by which
point the dropdown has unmounted.

```bash
git add src/components/SearchBar src/hooks/useSearchIndex.ts \
  src/hooks/useSearchIndex.test.tsx src/i18n
git commit -m "feat(search): add Turkish-aware search across places, categories and years"
```

---

## Task 7: Virtual list windowing and the Sidebar

973 rows at district level. Rendering them all costs a visible hitch on every
filter change, so the list windows to what is on screen. The windowing maths is
pure and goes in `core/`.

**Files:**
- Create: `src/core/list/window.ts`
- Create: `src/core/list/index.ts`
- Create: `src/hooks/useVirtualList.ts`
- Create: `src/components/Sidebar/Sidebar.tsx`
- Create: `src/components/Sidebar/SidebarRow.tsx`
- Create: `src/components/Sidebar/Sidebar.module.css`
- Create: `src/components/Sidebar/index.ts`
- Modify: `src/i18n/types.ts`, `src/i18n/tr.ts`, `src/i18n/index.ts`
- Test: `src/core/list/window.test.ts`
- Test: `src/components/Sidebar/Sidebar.test.tsx`

**Interfaces:**
- Produces (pure):
  - `ListWindow` — `{ startIndex: number; endIndex: number; offsetY: number; totalHeight: number }`
  - `computeWindow(options: { scrollTop: number; viewportHeight: number; rowHeight: number; count: number; overscan?: number }): ListWindow`
- Produces (React):
  - `VirtualList` — `{ ref: MutableRefObject<HTMLDivElement | null>; window: ListWindow; onScroll: () => void }`
  - `useVirtualList(rowHeight: number, count: number): VirtualList`
  - `Sidebar` — `(props: { rows: readonly RankedRegion[]; scale: ColorScale }) => JSX.Element`
- Produces, added to `Strings`:
  ```ts
  sidebar: {
    title: string; collapse: string; expand: string;
    sortByTotal: string; sortByName: string; share: string; empty: string;
  };
  ```

- [x] **Step 1: Write the failing window test**

Create `src/core/list/window.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeWindow } from './window.js';

const BASE = { scrollTop: 0, viewportHeight: 300, rowHeight: 30, count: 100 };

describe('computeWindow', () => {
  it('starts at the top with no overscan', () => {
    const w = computeWindow({ ...BASE, overscan: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(10);
    expect(w.offsetY).toBe(0);
  });

  it('reports the full scroll height so the scrollbar is honest', () => {
    expect(computeWindow(BASE).totalHeight).toBe(3000);
  });

  it('moves the window as the list scrolls', () => {
    const w = computeWindow({ ...BASE, scrollTop: 300, overscan: 0 });
    expect(w.startIndex).toBe(10);
    expect(w.offsetY).toBe(300);
  });

  it('aligns the offset to a row boundary, so rows do not jitter mid-scroll', () => {
    const w = computeWindow({ ...BASE, scrollTop: 305, overscan: 0 });
    expect(w.startIndex).toBe(10);
    expect(w.offsetY).toBe(300);
  });

  it('pads by the overscan on both sides', () => {
    const w = computeWindow({ ...BASE, scrollTop: 300, overscan: 3 });
    expect(w.startIndex).toBe(7);
    expect(w.endIndex).toBe(14);
  });

  it('never starts before the first row', () => {
    expect(computeWindow({ ...BASE, scrollTop: 0, overscan: 5 }).startIndex).toBe(0);
  });

  it('never ends past the last row', () => {
    const w = computeWindow({ ...BASE, scrollTop: 100_000, overscan: 5 });
    expect(w.endIndex).toBe(100);
    expect(w.startIndex).toBeLessThanOrEqual(w.endIndex);
  });

  it('handles an empty list', () => {
    const w = computeWindow({ ...BASE, count: 0 });
    expect(w).toEqual({ startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 });
  });

  it('handles a list shorter than the viewport', () => {
    const w = computeWindow({ ...BASE, count: 3, overscan: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(3);
    expect(w.totalHeight).toBe(90);
  });

  it('treats an unmeasured viewport as showing nothing rather than everything', () => {
    const w = computeWindow({ ...BASE, viewportHeight: 0, overscan: 0 });
    expect(w.endIndex).toBe(0);
  });

  it('refuses a non-positive row height instead of dividing by zero', () => {
    const w = computeWindow({ ...BASE, rowHeight: 0 });
    expect(w).toEqual({ startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 });
  });

  it('defaults to a non-zero overscan, so scrolling does not reveal blank rows', () => {
    const w = computeWindow({ ...BASE, scrollTop: 300 });
    expect(w.startIndex).toBeLessThan(10);
  });
});
```

- [x] **Step 2: Implement the window**

`src/core/list/window.ts`:

```ts
export interface ListWindow {
  /** First row to render, inclusive. */
  startIndex: number;
  /** Last row to render, exclusive. */
  endIndex: number;
  /** Pixel offset of `startIndex` from the top of the scroll content. */
  offsetY: number;
  /** Full height of every row, rendered or not. */
  totalHeight: number;
}

export interface WindowOptions {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  /** Extra rows rendered on each side, hiding the seam during a fast scroll. */
  overscan?: number;
}

const DEFAULT_OVERSCAN = 4;
const NOTHING: ListWindow = { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 };

/**
 * Which slice of a uniform-height list is worth rendering.
 *
 * `offsetY` is aligned to a row boundary rather than tracking `scrollTop`
 * exactly: the rendered slice is positioned by that offset, and a sub-row value
 * would make every row shimmer by a few pixels as you scroll.
 *
 * A zero viewport renders nothing rather than everything — the alternative
 * mounts all 973 rows during the first frame, before layout has run, which is
 * exactly the cost this function exists to avoid.
 */
export function computeWindow(options: WindowOptions): ListWindow {
  const { scrollTop, viewportHeight, rowHeight, count, overscan = DEFAULT_OVERSCAN } = options;
  if (rowHeight <= 0 || count <= 0) return NOTHING;

  const totalHeight = count * rowHeight;
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visibleCount = Math.ceil(Math.max(0, viewportHeight) / rowHeight);

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(count, firstVisible + visibleCount + overscan);

  return {
    startIndex,
    endIndex: Math.max(startIndex, endIndex),
    offsetY: startIndex * rowHeight,
    totalHeight,
  };
}
```

`src/core/list/index.ts`:

```ts
export type { ListWindow, WindowOptions } from './window.js';
export { computeWindow } from './window.js';
```

- [x] **Step 3: Run the window test and check coverage**

```bash
npx vitest run src/core/list/window.test.ts
npx vitest run --coverage
```

Expected: PASS, 12 tests, `window.ts` at 100%.

- [x] **Step 4: Implement `useVirtualList`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeWindow, type ListWindow } from '@/core/list/index.js';

export interface VirtualList {
  ref: React.MutableRefObject<HTMLDivElement | null>;
  window: ListWindow;
  onScroll: () => void;
}

/**
 * Tracks scroll position and viewport height for a uniform-height list.
 *
 * Scroll position is state, not a ref, because the rendered slice depends on
 * it. It updates at most once per scroll event, and each update re-renders only
 * the rows in the window — not the 900-odd outside it.
 */
export function useVirtualList(rowHeight: number, count: number): VirtualList {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onScroll = useCallback(() => {
    const node = ref.current;
    if (node !== null) setScrollTop(node.scrollTop);
  }, []);

  // The list has no size on the first render, so the window would be empty
  // forever without measuring after mount.
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    setViewportHeight(node.clientHeight);
    if (typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(() => { setViewportHeight(node.clientHeight); });
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  return {
    ref,
    onScroll,
    window: computeWindow({ scrollTop, viewportHeight, rowHeight, count }),
  };
}
```

- [x] **Step 5: Add the sidebar strings**

`src/i18n/types.ts`:

```ts
  sidebar: {
    title: string;
    collapse: string;
    expand: string;
    sortByTotal: string;
    sortByName: string;
    share: string;
    empty: string;
  };
```

`src/i18n/tr.ts`:

```ts
  sidebar: {
    title: 'Bölgeler',
    collapse: 'Listeyi daralt',
    expand: 'Listeyi genişlet',
    sortByTotal: 'Sayıya göre sırala',
    sortByName: 'Ada göre sırala',
    share: 'Pay',
    empty: 'Gösterilecek bölge yok',
  },
```

Add `sidebar: mergeGroup('sidebar', overrides),` to `src/i18n/index.ts`.

- [x] **Step 6: Write the failing Sidebar test**

Create `src/components/Sidebar/Sidebar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import { createColorScale } from '@/core/color/index.js';
import { trStrings } from '@/i18n/index.js';
import { Sidebar } from './Sidebar.js';

const ROWS: RankedRegion[] = [
  { code: '34', name: 'İstanbul', total: 900, share: 0.6, rank: 1 },
  { code: '06', name: 'Ankara', total: 400, share: 0.27, rank: 2 },
  { code: '35', name: 'İzmir', total: 200, share: 0.13, rank: 3 },
];
const SCALE = createColorScale({ values: [900, 400, 200], mode: 'quantile', ramp: 'spectral' });

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

function renderSidebar(rows: RankedRegion[] = ROWS) {
  const store = createHeatMapStore(base);
  const hoverStore = createHoverStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<Sidebar rows={rows} scale={SCALE} />, { wrapper });
  return { ...utils, store, hoverStore };
}

describe('Sidebar', () => {
  it('is labelled as a group', () => {
    renderSidebar();
    expect(screen.getByRole('group', { name: trStrings.sidebar.title })).toBeInTheDocument();
  });

  it('renders a row per region with name, count and share', () => {
    renderSidebar();
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('%60,0')).toBeInTheDocument();
  });

  it('says so when there is nothing to list', () => {
    renderSidebar([]);
    expect(screen.getByText(trStrings.sidebar.empty)).toBeInTheDocument();
  });

  it('requests a fly-to when a row is clicked', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /İstanbul/u }));
    expect(store.getState().flyToRequest).toBe('34');
  });

  it('selects the region it flew to', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Ankara/u }));
    expect(store.getState().selectedCode).toBe('06');
  });

  it('highlights the map region on row hover, tagged as a list hover', () => {
    const { hoverStore } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İzmir/u }));
    expect(hoverStore.getState()).toEqual({ code: '35', x: 0, y: 0, source: 'list' });
  });

  it('clears the highlight on row leave', () => {
    const { hoverStore } = renderSidebar();
    const row = screen.getByRole('button', { name: /İzmir/u });
    fireEvent.pointerEnter(row);
    fireEvent.pointerLeave(row);
    expect(hoverStore.getState()).toBeNull();
  });

  it('marks the row matching a map hover, so the link works in both directions', () => {
    const { hoverStore, container } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İstanbul/u }));
    expect(hoverStore.getState()?.code).toBe('34');
    expect(container.querySelector('[data-hovered="true"]')?.textContent)
      .toContain('İstanbul');
  });

  it('sorts by name when asked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.sortByName }));

    const names = screen.getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /İstanbul|Ankara|İzmir/u.test(t));
    expect(names[0]).toContain('Ankara');
  });

  it('collapses to a rail and back', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));
    expect(screen.queryByText('İstanbul')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.expand }));
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
  });

  it('tints each row bar with that region heat colour', () => {
    const { container } = renderSidebar();
    const bar = container.querySelector('[data-role="bar"]') as HTMLElement;
    expect(bar.style.background).not.toBe('');
  });

  it('renders only a window of rows for a long list', () => {
    const many: RankedRegion[] = Array.from({ length: 973 }, (_, i) => ({
      code: String(i).padStart(4, '0'),
      name: `Bölge ${i}`,
      total: 973 - i,
      share: 0.001,
      rank: i + 1,
    }));
    const { container } = renderSidebar(many);

    // jsdom reports clientHeight 0, so the window is empty rather than 973 —
    // which is itself the guarantee: the list never mounts every row up front.
    expect(container.querySelectorAll('[data-role="row"]').length).toBeLessThan(973);
  });
});
```

- [x] **Step 7: Implement the row**

`src/components/Sidebar/SidebarRow.tsx`:

```tsx
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import styles from './Sidebar.module.css';

export interface SidebarRowProps {
  region: RankedRegion;
  color: string;
  hovered: boolean;
  selected: boolean;
  onActivate: (code: string) => void;
  onHover: (code: string | null) => void;
  height: number;
}

/** One ranked region. Name, count, share, and a bar tinted with its heat colour. */
export function SidebarRow({
  region, color, hovered, selected, onActivate, onHover, height,
}: SidebarRowProps) {
  return (
    <button
      type="button"
      data-role="row"
      data-hovered={hovered ? 'true' : 'false'}
      className={styles.row}
      style={{ height }}
      aria-current={selected ? true : undefined}
      onClick={() => { onActivate(region.code); }}
      onPointerEnter={() => { onHover(region.code); }}
      onPointerLeave={() => { onHover(null); }}
    >
      <span className={styles.rowName}>{region.name}</span>
      <span className={styles.rowTotal}>{formatTrNumber(region.total)}</span>
      <span className={styles.rowShare}>{formatPercent(region.share)}</span>
      <span
        className={styles.bar}
        data-role="bar"
        style={{ width: `${Math.max(2, region.share * 100)}%`, background: color }}
        aria-hidden="true"
      />
    </button>
  );
}
```

- [x] **Step 8: Implement the Sidebar**

`src/components/Sidebar/Sidebar.module.css`:

```css
.sidebar { display: grid; grid-template-rows: auto 1fr; max-height: 100%; width: 240px; }
.sidebar[data-collapsed='true'] { width: 48px; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 8px 6px;
}

.title { margin: 0; font-size: 12px; font-weight: 600; color: var(--hm-fg); }
.actions { display: flex; gap: 2px; }
.scroller { overflow-y: auto; padding: 0 4px 6px; }
.spacer { position: relative; width: 100%; }
.slice { position: absolute; left: 0; right: 0; display: grid; }

.row {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--hm-fg);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.row:hover,
.row[data-hovered='true'] { background: rgba(255, 255, 255, 0.08); }
.row[aria-current='true'] { background: rgba(255, 255, 255, 0.14); }
.row:focus-visible { outline: 2px solid var(--hm-focus-ring); outline-offset: -2px; }

.rowName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rowTotal { font-variant-numeric: tabular-nums; }
.rowShare { font-variant-numeric: tabular-nums; color: var(--hm-fg-muted); font-size: 11px; }

.bar {
  position: absolute;
  left: 6px;
  bottom: 2px;
  height: 2px;
  border-radius: 1px;
  opacity: 0.8;
}

.empty { padding: 12px 8px; font-size: 12px; color: var(--hm-fg-muted); }
```

`src/components/Sidebar/Sidebar.tsx`:

```tsx
import { useCallback, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { IconButton } from '@/components/primitives/IconButton.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import type { ColorScale } from '@/core/color/index.js';
import { compareTurkish } from '@/core/search/index.js';
import { useHeatMapDispatch, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget, useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import { useVirtualList } from '@/hooks/useVirtualList.js';
import { SidebarRow } from './SidebarRow.js';
import styles from './Sidebar.module.css';

const ROW_HEIGHT = 26;

export interface SidebarProps {
  rows: readonly RankedRegion[];
  scale: ColorScale;
}

export function Sidebar({ rows, scale }: SidebarProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const setHover = useSetHoverTarget();
  const hover = useHoverTarget();

  // Sort and collapse are this panel's own affair — no other panel reads them,
  // so they stay out of the shared store (§7.8).
  const [byName, setByName] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sorted = useMemo(() => (
    byName ? [...rows].sort((a, b) => compareTurkish(a.name, b.name)) : rows
  ), [rows, byName]);

  const list = useVirtualList(ROW_HEIGHT, sorted.length);

  const onActivate = useCallback((code: string) => {
    dispatch({ type: 'select', code });
    dispatch({ type: 'requestFlyTo', code });
  }, [dispatch]);

  const onHover = useCallback((code: string | null) => {
    if (code === null) { setHover({ type: 'leave' }); return; }
    // Coordinates are meaningless for a list hover; `source` is what stops the
    // tooltip opening in the corner attached to nothing.
    setHover({ type: 'enter', target: { code, x: 0, y: 0, source: 'list' } });
  }, [setHover]);

  const slice = sorted.slice(list.window.startIndex, list.window.endIndex);

  return (
    <GlassPanel label={strings.sidebar.title} className={styles.sidebar}>
      <div className={styles.header} data-collapsed={collapsed ? 'true' : 'false'}>
        {collapsed ? null : <h2 className={styles.title}>{strings.sidebar.title}</h2>}
        <div className={styles.actions}>
          {collapsed ? null : (
            <IconButton
              label={byName ? strings.sidebar.sortByTotal : strings.sidebar.sortByName}
              onClick={() => { setByName((v) => !v); }}
            >
              {byName ? '#' : 'A'}
            </IconButton>
          )}
          <IconButton
            label={collapsed ? strings.sidebar.expand : strings.sidebar.collapse}
            onClick={() => { setCollapsed((v) => !v); }}
          >
            {collapsed ? '»' : '«'}
          </IconButton>
        </div>
      </div>

      {collapsed ? null : (
        <div ref={list.ref} className={styles.scroller} onScroll={list.onScroll}>
          {sorted.length === 0 ? (
            <p className={styles.empty}>{strings.sidebar.empty}</p>
          ) : (
            <div className={styles.spacer} style={{ height: list.window.totalHeight }}>
              <div className={styles.slice} style={{ transform: `translateY(${list.window.offsetY}px)` }}>
                {slice.map((region) => (
                  <SidebarRow
                    key={region.code}
                    region={region}
                    color={scale(region.total)}
                    hovered={hover?.code === region.code}
                    selected={false}
                    height={ROW_HEIGHT}
                    onActivate={onActivate}
                    onHover={onHover}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
```

- [x] **Step 9: Write the barrel, run and commit**

`src/components/Sidebar/index.ts`:

```ts
export type { SidebarProps } from './Sidebar.js';
export { Sidebar } from './Sidebar.js';
```

```bash
npx vitest run src/core/list src/components/Sidebar src/hooks
npm run typecheck && npm run lint
```

Expected: PASS, 12 window tests + 12 Sidebar tests.

The virtualization test asserts fewer than 973 rows render. If it fails with
exactly 973, `useVirtualList` is falling back to rendering everything when
unmeasured — `computeWindow` must return an empty window for a zero viewport,
not a full one.

```bash
git add src/core/list src/hooks/useVirtualList.ts src/components/Sidebar src/i18n
git commit -m "feat(sidebar): add virtualized ranked region list with map hover linking"
```

---

**Part 2 ends here.** Tasks 8–11 (charts, layout, panel matrix, exit
verification) are in
`docs/superpowers/plans/2026-08-01-phase-3-panels-part-3.md`.
