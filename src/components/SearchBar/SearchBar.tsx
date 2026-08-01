import { useCallback, useId, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { searchEntities, type SearchEntity, type SearchEntityType } from '@/core/search/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
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

  /*
   * The dropdown closes when the field loses focus, and comes back when it
   * regains it with a query still in place.
   *
   * `onMouseDown` on an option calls `preventDefault`, so choosing one never
   * blurs the input and this cannot fire underneath a selection.
   */
  const onBlur = useCallback(() => { setOpen(false); }, []);
  const onFocus = useCallback(() => { setOpen(true); }, []);

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
        onFocus={onFocus}
        onBlur={onBlur}
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
                <ul>
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
