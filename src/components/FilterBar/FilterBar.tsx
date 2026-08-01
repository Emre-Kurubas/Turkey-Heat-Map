import { useCallback, useState } from 'react';
import { Chip } from '@/components/primitives/Chip.js';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
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
  const [open, setOpen] = useState(false);

  // Count what is actually narrowing the data, so a closed bar still says so.
  // Hiding active filters behind a shut panel is how someone ends up reading a
  // filtered map as the whole picture.
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
        <button
          type="button"
          className={styles.reset}
          aria-expanded
          aria-label={strings.filters.close}
          onClick={() => { setOpen(false); }}
        >
          ×
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
