import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { FilterBar, type FilterBarProps } from './FilterBar.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const TOTALS = new Map([['hirsizlik', 1200], ['darp', 340]]);

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
  metric: 'total',
  scaleMode: 'quantile',
};

/** Renders the bar in its default collapsed state. */
function renderBarClosed(state: HeatMapState = base, props: Partial<FilterBarProps> = {}) {
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

/**
 * Renders it and opens it, which is what every assertion below assumes — the
 * controls now live behind the toggle.
 */
function renderBar(state: HeatMapState = base, props: Partial<FilterBarProps> = {}) {
  const utils = renderBarClosed(state, props);
  fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));
  return utils;
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
    expect(screen.getByText(new RegExp(trStrings.filters.allCategories, 'u')))
      .toBeInTheDocument();
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

  it('switches back to totals on a second press', () => {
    const perCapita: HeatMapState = { ...base, metric: 'perCapita' };
    const { store } = renderBar(perCapita, { hasPopulation: true });
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.perCapita }));
    expect(store.getState().metric).toBe('total');
  });

  it('highlights the chip matching a hovered pie slice', () => {
    const { container } = renderBar(base, { highlightedCategory: 'darp' });
    const highlighted = container.querySelectorAll('[data-highlighted="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.textContent).toContain('Darp');
  });
});

describe('FilterBar — collapsed by default', () => {
  it('shows only a button until it is opened', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }))
      .toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hırsızlık/u })).not.toBeInTheDocument();
  });

  it('reports its state through aria-expanded', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  it('reveals the controls when opened', () => {
    renderBarClosed();
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));

    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Hırsızlık/u })).toBeInTheDocument();
  });

  it('closes again on a second press', () => {
    renderBarClosed();
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.open }));
    fireEvent.click(screen.getByRole('button', { name: trStrings.filters.close }));
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  /**
   * A closed filter bar must not hide the fact that filters are active — that
   * is how someone ends up reading a filtered map as the whole picture.
   */
  it('shows an active-filter count on the button while closed', () => {
    const filtered: HeatMapState = {
      ...base,
      filters: { yearRange: [2018, 2019], categories: ['darp'] },
    };
    renderBarClosed(filtered);
    expect(screen.getByRole('button', { name: trStrings.filters.open }).textContent)
      .toMatch(/2/u);
  });

  it('shows no count when nothing is filtered', () => {
    renderBarClosed();
    expect(screen.getByRole('button', { name: trStrings.filters.open }).textContent)
      .not.toMatch(/\d/u);
  });
});
