import { useCallback, useId, useMemo, useState } from 'react';
import { categoryColor } from '@/core/chart/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import { compareTurkish, foldTurkish, scoreEntity } from '@/core/search/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './FilterBar.module.css';

/**
 * How many rows the list draws at once.
 *
 * A cap rather than virtualisation. With a search box above it, the useful
 * states of this list are "the common ones" and "the few that matched what I
 * typed" — neither is long. Windowing thousands of rows would be machinery in
 * service of a state no one wants to be in, and it would still leave them
 * scrolling a thousand rows to find one.
 *
 * The footer says how many were left out, because a silently truncated list
 * reads as a complete one.
 */
const VISIBLE_LIMIT = 40;

export interface CategoryFilterProps {
  categories: readonly CrimeCategory[];
  /** Total per category for the active filters, shown on each row. */
  categoryTotals: ReadonlyMap<string, number>;
  /** Currently filtered ids. Empty means every category (see FilterSet). */
  selected: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  /** Category whose pie slice is hovered, or null. */
  highlighted: string | null;
}

interface Row {
  id: string;
  label: string;
  color: string;
  total: number;
  folded: string;
}

/**
 * Picking crime types out of a list that may run to thousands.
 *
 * A row of chips was the original design and it only ever worked because the
 * sample data has eight categories. Real crime taxonomies have thousands, and
 * at that size a chip row is not a slow control, it is not a control at all —
 * every one of them renders, the panel becomes a wall of buttons, and finding a
 * specific offence means reading the wall.
 *
 * So: search first, and rank what is shown. With no query the list is ordered
 * by count, which puts the categories that actually carry the map at the top;
 * with a query it is ordered by match, through the same Turkish-aware scorer
 * the search bar uses — `foldTurkish` is what makes "sılah" find "Silah", which
 * `toLowerCase` would not.
 *
 * Whatever is selected is pinned above the search box as removable chips. That
 * is the part a long list breaks without: once a selection scrolls out of view,
 * or a query hides it, the reader has no way to see what they have chosen and
 * no way to undo it except by clearing everything.
 */
export function CategoryFilter({
  categories, categoryTotals, selected, onToggle, onClear, highlighted,
}: CategoryFilterProps) {
  const strings = useStrings();
  const [query, setQuery] = useState('');
  const inputId = useId();

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Folded once per category list, not per keystroke.
  const rows = useMemo<Row[]>(() => categories.map((category, index) => ({
    id: category.id,
    label: category.label,
    color: category.color ?? categoryColor(index),
    total: categoryTotals.get(category.id) ?? 0,
    folded: foldTurkish(category.label),
  })), [categories, categoryTotals]);

  const matched = useMemo(() => {
    const folded = foldTurkish(query.trim());

    if (folded === '') {
      // Biggest first, ties alphabetical so the order never depends on the
      // consumer's array order.
      return [...rows].sort((a, b) => b.total - a.total || compareTurkish(a.label, b.label));
    }

    const scored: { row: Row; score: number }[] = [];
    for (const row of rows) {
      // Scored through the search entity shape, so one matcher serves the
      // search bar and this list and they can never disagree about what
      // "matches".
      const score = scoreEntity(folded, {
        type: 'category', id: row.id, label: row.label, folded: row.folded, parentLabel: null,
      });
      if (score > 0) scored.push({ row, score });
    }
    scored.sort((a, b) => b.score - a.score || compareTurkish(a.row.label, b.row.label));
    return scored.map((entry) => entry.row);
  }, [rows, query]);

  const shown = matched.slice(0, VISIBLE_LIMIT);
  const hidden = matched.length - shown.length;

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(row.id))
      .sort((a, b) => compareTurkish(a.label, b.label)),
    [rows, selectedSet],
  );

  const onQueryChange = useCallback((value: string) => { setQuery(value); }, []);

  return (
    <div className={styles.section}>
      <div className={styles.categoryHead}>
        <span className={styles.sectionLabel} id={inputId}>
          {strings.filters.categories}
        </span>
        {/* An empty selection means every category, not none — say so, because
            a list of unticked rows otherwise reads as "nothing selected". */}
        <span className={styles.selectionCount} data-role="selection-count">
          {selected.length === 0
            ? strings.filters.allCategories
            : `${formatTrNumber(selected.length)} ${strings.filters.selectedSuffix}`}
        </span>
      </div>

      {selectedRows.length === 0 ? null : (
        <div className={styles.selectedChips}>
          {selectedRows.map((row) => (
            <button
              key={row.id}
              type="button"
              data-role="selected-chip"
              className={styles.selectedChip}
              aria-label={`${row.label} · ${strings.filters.removeCategory}`}
              onClick={() => { onToggle(row.id); }}
            >
              <span
                className={styles.chipSwatch}
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <span className={styles.chipLabel}>{row.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            data-role="clear-categories"
            className={styles.clearChips}
            onClick={onClear}
          >
            {strings.filters.clearCategories}
          </button>
        </div>
      )}

      <input
        type="search"
        className={styles.categorySearch}
        data-role="category-search"
        value={query}
        aria-labelledby={inputId}
        placeholder={strings.filters.searchCategories}
        onChange={(event) => { onQueryChange(event.target.value); }}
      />

      {shown.length === 0 ? (
        <p className={styles.noMatches}>{strings.filters.noCategoryMatch}</p>
      ) : (
        <ul className={styles.categoryList} data-role="category-list">
          {shown.map((row) => {
            const isOn = selectedSet.has(row.id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  data-role="category-row"
                  data-id={row.id}
                  data-highlighted={row.id === highlighted ? 'true' : 'false'}
                  className={styles.categoryRow}
                  // A checkbox, not a toggle button: these are independent
                  // choices from a set, which is what `checkbox` means and what
                  // a screen reader will announce.
                  role="checkbox"
                  aria-checked={isOn}
                  onClick={() => { onToggle(row.id); }}
                >
                  <span
                    className={styles.categoryBox}
                    data-checked={isOn ? 'true' : 'false'}
                    style={{ background: isOn ? row.color : 'transparent', borderColor: row.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.categoryLabel}>{row.label}</span>
                  <span className={styles.categoryCount}>{formatTrNumber(row.total)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 ? (
        <p className={styles.moreResults} data-role="more-results">
          {`+${formatTrNumber(hidden)} ${strings.filters.moreCategories}`}
        </p>
      ) : null}
    </div>
  );
}
