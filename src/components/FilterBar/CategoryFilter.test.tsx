import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CategoryFilter, type CategoryFilterProps } from './CategoryFilter.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'silah', label: 'Silahla yaralama' },
  { id: 'darp', label: 'Darp' },
  { id: 'gasp', label: 'Gasp' },
];

const TOTALS = new Map([
  ['hirsizlik', 900], ['silah', 400], ['darp', 120], ['gasp', 7],
]);

const DEFAULTS = { yearRange: [2015, 2024] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: DEFAULTS,
  defaultFilters: DEFAULTS,
  yearBounds: [2015, 2024],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderFilter(props: Partial<CategoryFilterProps> = {}) {
  const onToggle = props.onToggle ?? vi.fn();
  const onClear = props.onClear ?? vi.fn();
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
    <CategoryFilter
      categories={CATEGORIES}
      categoryTotals={TOTALS}
      selected={[]}
      highlighted={null}
      {...props}
      onToggle={onToggle}
      onClear={onClear}
    />,
    { wrapper },
  );
  return { ...utils, onToggle, onClear };
}

/** A taxonomy at the scale this control exists for. */
function manyCategories(count: number): CrimeCategory[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    label: `Suç türü ${String(i).padStart(4, '0')}`,
  }));
}

const rowLabels = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-role="category-row"]')]
    .map((row) => row.querySelector('span:nth-child(2)')?.textContent ?? '');

function search(text: string): void {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });
}

describe('CategoryFilter', () => {
  it('lists every category as a checkbox', () => {
    renderFilter();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('shows each category total beside it', () => {
    const { container } = renderFilter();
    const row = container.querySelector('[data-role="category-row"][data-id="hirsizlik"]')!;
    expect(row.textContent).toContain('900');
  });

  it('reports a toggle to its owner', () => {
    const { onToggle } = renderFilter();
    fireEvent.click(screen.getByRole('checkbox', { name: /Darp/u }));
    expect(onToggle).toHaveBeenCalledWith('darp');
  });

  it('ticks what is selected', () => {
    renderFilter({ selected: ['darp'] });
    expect(screen.getByRole('checkbox', { name: /Darp/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Gasp/u })).not.toBeChecked();
  });

  it('says "all" when nothing is ticked, since empty means every category', () => {
    const { container } = renderFilter();
    expect(container.querySelector('[data-role="selection-count"]')?.textContent)
      .toBe(trStrings.filters.allCategories);
  });

  it('counts the selection once there is one', () => {
    const { container } = renderFilter({ selected: ['darp', 'gasp'] });
    expect(container.querySelector('[data-role="selection-count"]')?.textContent)
      .toContain('2');
  });

  it('highlights the row matching a hovered pie slice', () => {
    const { container } = renderFilter({ highlighted: 'gasp' });
    const marked = container.querySelectorAll('[data-role="category-row"][data-highlighted="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toContain('Gasp');
  });
});

describe('CategoryFilter — ordering', () => {
  it('puts the biggest categories first, unsearched', () => {
    // With thousands of types, the ones that carry the map are the only
    // sensible thing to open on.
    const { container } = renderFilter();
    expect(rowLabels(container)).toEqual(['Hırsızlık', 'Silahla yaralama', 'Darp', 'Gasp']);
  });

  it('breaks ties alphabetically rather than by the consumer array order', () => {
    const flat = new Map(CATEGORIES.map((category) => [category.id, 5]));
    const { container } = renderFilter({ categoryTotals: flat });
    expect(rowLabels(container)).toEqual(['Darp', 'Gasp', 'Hırsızlık', 'Silahla yaralama']);
  });
});

describe('CategoryFilter — searching', () => {
  it('narrows the list to what matches, best first', () => {
    // "Gasp" survives too, two edits from "darp" — the scorer is deliberately
    // typo-tolerant, and an exact hit still outranks a fuzzy one by 800 points.
    const { container } = renderFilter();
    search('darp');
    expect(rowLabels(container)[0]).toBe('Darp');
    expect(rowLabels(container)).not.toContain('Hırsızlık');
  });

  it('folds Turkish, so a dotless i still finds a dotted one', () => {
    // The whole reason this uses foldTurkish rather than toLowerCase: the
    // built-in conversion is wrong on the İ/I pair and would find nothing.
    const { container } = renderFilter();
    search('HIRSIZLIK');
    expect(rowLabels(container)).toEqual(['Hırsızlık']);
  });

  it('tolerates a typo', () => {
    const { container } = renderFilter();
    search('hırsızlk');
    expect(rowLabels(container)).toContain('Hırsızlık');
  });

  it('matches inside a label, not only at its start', () => {
    const { container } = renderFilter();
    search('yaralama');
    expect(rowLabels(container)).toEqual(['Silahla yaralama']);
  });

  it('says so when nothing matches', () => {
    renderFilter();
    search('zzzz');
    expect(screen.getByText(trStrings.filters.noCategoryMatch)).toBeInTheDocument();
  });

  it('keeps a ticked category ticked through a search', () => {
    renderFilter({ selected: ['darp'] });
    search('darp');
    expect(screen.getByRole('checkbox', { name: /Darp/u })).toBeChecked();
  });
});

describe('CategoryFilter — thousands of categories', () => {
  const many = manyCategories(3000);
  const manyTotals = new Map(many.map((category, i) => [category.id, 3000 - i]));

  it('draws a bounded number of rows rather than all of them', () => {
    const { container } = renderFilter({ categories: many, categoryTotals: manyTotals });
    const rows = container.querySelectorAll('[data-role="category-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(40);
  });

  it('says how many it left out, so the list does not read as complete', () => {
    const { container } = renderFilter({ categories: many, categoryTotals: manyTotals });
    const note = container.querySelector('[data-role="more-results"]');
    expect(note?.textContent).toContain('2.960');
  });

  it('drops the note once a search brings the list under the cap', () => {
    const { container } = renderFilter({ categories: many, categoryTotals: manyTotals });
    search('2999');
    expect(container.querySelector('[data-role="more-results"]')).toBeNull();
  });

  it('finds one category out of three thousand', () => {
    const { container } = renderFilter({ categories: many, categoryTotals: manyTotals });
    search('2999');
    expect(rowLabels(container)).toEqual(['Suç türü 2999']);
  });
});

describe('CategoryFilter — the selection stays visible', () => {
  const many = manyCategories(3000);
  const manyTotals = new Map(many.map((category, i) => [category.id, 3000 - i]));

  it('pins the selected categories above the search box', () => {
    // The row for c2999 is nowhere near the top of a 3000-item list, so without
    // this the reader cannot see what they picked, let alone undo it.
    const { container } = renderFilter({
      categories: many, categoryTotals: manyTotals, selected: ['c2999'],
    });
    const chips = container.querySelectorAll('[data-role="selected-chip"]');
    expect(chips).toHaveLength(1);
    expect(chips[0]?.textContent).toContain('Suç türü 2999');
  });

  it('keeps them pinned while a search hides their rows', () => {
    const { container } = renderFilter({
      categories: many, categoryTotals: manyTotals, selected: ['c2999'],
    });
    search('Suç türü 0001');
    expect(container.querySelectorAll('[data-role="selected-chip"]')).toHaveLength(1);
  });

  it('removes one when its chip is pressed', () => {
    const { container, onToggle } = renderFilter({ selected: ['darp'] });
    const chip = container.querySelector('[data-role="selected-chip"]') as HTMLElement;
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith('darp');
  });

  it('names the chip as the thing it removes, not just as the category', () => {
    const { container } = renderFilter({ selected: ['darp'] });
    const chip = container.querySelector('[data-role="selected-chip"]')!;
    expect(chip.getAttribute('aria-label')).toContain(trStrings.filters.removeCategory);
  });

  it('clears the whole selection in one press', () => {
    const { container, onClear } = renderFilter({ selected: ['darp', 'gasp'] });
    fireEvent.click(container.querySelector('[data-role="clear-categories"]') as HTMLElement);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows no chip row at all when nothing is selected', () => {
    const { container } = renderFilter();
    expect(container.querySelector('[data-role="selected-chip"]')).toBeNull();
    expect(container.querySelector('[data-role="clear-categories"]')).toBeNull();
  });

  it('lists the pinned chips alphabetically, so they do not reshuffle', () => {
    const { container } = renderFilter({ selected: ['silah', 'darp', 'gasp'] });
    const chips = [...container.querySelectorAll('[data-role="selected-chip"]')]
      .map((chip) => chip.querySelector('[class*="chipLabel"]')?.textContent);
    expect(chips).toEqual(['Darp', 'Gasp', 'Silahla yaralama']);
  });
});
