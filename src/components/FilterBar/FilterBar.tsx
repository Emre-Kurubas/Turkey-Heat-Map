import { useCallback, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { IconButton } from '@/components/primitives/IconButton.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { CategoryFilter } from './CategoryFilter.js';
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

  const [open, setOpen] = useState(false);

  const onToggleCategory = useCallback((id: string) => {
    dispatch({ type: 'toggleCategory', id });
  }, [dispatch]);

  const onClearCategories = useCallback(() => {
    dispatch({ type: 'setFilters', filters: { ...filters, categories: [] } });
  }, [dispatch, filters]);

  // Count what is actually narrowing the data, so a closed bar still says so.
  // Hiding active filters behind a shut panel is how someone ends up reading a
  // filtered map as the whole picture. The year range still counts even though
  // it is set elsewhere now: the badge is about what is filtered, not about
  // which control did it.
  const [lo, hi] = filters.yearRange;
  const [boundLo, boundHi] = yearBounds;
  const activeCount = filters.categories.length
    + (lo !== boundLo || hi !== boundHi ? 1 : 0);

  /*
   * The toggle stays mounted while the panel is open, and the panel hangs off
   * it absolutely. Swapping one for the other made the control 300px wide the
   * instant it opened, which shoved the search field sideways — they share a
   * centred row now, so a width change on either one moves the other.
   */
  return (
    <div className={styles.anchor}>
      <GlassPanel className={styles.collapsed}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-label={open ? strings.filters.close : strings.filters.open}
          onClick={() => { setOpen((v) => !v); }}
        >
          <span>{strings.filters.title}</span>
          {/* The active year range is written across the map's top right — see
              YearScope. Repeating it here made the same fact compete with
              itself two panels apart. */}
          {activeCount > 0 ? (
            <span className={styles.badge}>{formatTrNumber(activeCount)}</span>
          ) : null}
        </button>
      </GlassPanel>

      {open ? (
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

      <CategoryFilter
        categories={categories}
        categoryTotals={categoryTotals}
        selected={filters.categories}
        onToggle={onToggleCategory}
        onClear={onClearCategories}
        highlighted={highlightedCategory}
      />

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
      ) : null}
    </div>
  );
}
