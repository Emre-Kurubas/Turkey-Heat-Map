import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { CATEGORY_PALETTE } from '@/core/chart/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CategoryPieChart, type CategoryPieChartProps } from './CategoryPieChart.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
  { id: 'c', label: 'Gasp' },
];
const TOTALS = new Map([['a', 600], ['b', 300], ['c', 100]]);

const EIGHT: CrimeCategory[] = Array.from({ length: 8 }, (_, i) => ({
  id: `k${i}`, label: `Kategori ${i}`,
}));
const EIGHT_TOTALS = new Map(EIGHT.map((c, i) => [c.id, 100 - i]));

/** One dominant category and a tail of slivers, each well under 3%. */
const TAILED_TOTALS = new Map(EIGHT.map((c, i) => [c.id, i === 0 ? 900 : 10]));

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
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderPie(props: Partial<CategoryPieChartProps> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  return render(
    <CategoryPieChart
      categories={CATEGORIES}
      totals={TOTALS}
      regionName={null}
      onHoverCategory={() => {}}
      {...props}
    />,
    { wrapper },
  );
}

const otherToggle = () =>
  screen.getByRole('button', { name: new RegExp(trStrings.pie.other, 'u') });

describe('CategoryPieChart', () => {
  it('is labelled as a group', () => {
    renderPie();
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
  });

  it('says it is showing the national picture when no region is selected', () => {
    renderPie();
    expect(screen.getByText(trStrings.pie.national)).toBeInTheDocument();
  });

  it('names the selected region instead when there is one', () => {
    renderPie({ regionName: 'İstanbul' });
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
  });

  it('draws an arc per category', () => {
    const { container } = renderPie();
    expect(container.querySelectorAll('path[data-slice]')).toHaveLength(3);
  });

  it('colours each slice by its position in the category list, not its rank', () => {
    // 'c' is the smallest but is third in `categories`, so it takes slot 3.
    const { container } = renderPie();
    expect(container.querySelector('path[data-slice="c"]')?.getAttribute('fill'))
      .toBe(CATEGORY_PALETTE[2]);
  });

  it('keeps a category colour stable when a larger one is removed', () => {
    const { container, rerender } = renderPie();
    const before = container.querySelector('path[data-slice="c"]')?.getAttribute('fill');

    rerender(
      <CategoryPieChart
        categories={CATEGORIES}
        totals={new Map([['b', 300], ['c', 100]])}
        regionName={null}
        onHoverCategory={() => {}}
      />,
    );
    expect(container.querySelector('path[data-slice="c"]')?.getAttribute('fill')).toBe(before);
  });

  it('honours a consumer colour override', () => {
    const { container } = renderPie({
      categories: [{ id: 'a', label: 'A', color: '#123456' }],
      totals: new Map([['a', 10]]),
    });
    expect(container.querySelector('path[data-slice="a"]')?.getAttribute('fill'))
      .toBe('#123456');
  });

  it('lists every slice with its label, value and share', () => {
    renderPie();
    expect(screen.getByText('Hırsızlık')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('%60,0')).toBeInTheDocument();
  });

  it('reports a hovered slice so the filter chip can highlight', () => {
    const onHoverCategory = vi.fn();
    const { container } = renderPie({ onHoverCategory });

    fireEvent.pointerEnter(container.querySelector('path[data-slice="a"]')!);
    expect(onHoverCategory).toHaveBeenCalledWith('a');

    fireEvent.pointerLeave(container.querySelector('path[data-slice="a"]')!);
    expect(onHoverCategory).toHaveBeenCalledWith(null);
  });

  it('dims the other slices while one is hovered', () => {
    const { container } = renderPie();
    fireEvent.pointerEnter(container.querySelector('path[data-slice="a"]')!);
    expect(container.querySelectorAll('path[data-dimmed="true"]')).toHaveLength(2);
  });

  it('folds a tail of slivers into Diğer', () => {
    renderPie({ categories: EIGHT, totals: TAILED_TOTALS });
    // The dominant category plus one Diğer holding the seven slivers.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(trStrings.pie.other)).toBeInTheDocument();
  });

  /**
   * Folding is only an improvement when the tail it hides is genuinely small.
   * Türkiye's crime categories are near-equal, and a cap tight enough to fold
   * them produced a Diğer larger than every real category — the biggest thing
   * in the chart, meaning nothing.
   */
  it('does not fold near-equal categories, which would make Diğer the largest slice', () => {
    renderPie({ categories: EIGHT, totals: EIGHT_TOTALS });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.queryByText(trStrings.pie.other)).not.toBeInTheDocument();
  });

  it('expands Diğer on click, revealing what it hid', () => {
    renderPie({ categories: EIGHT, totals: TAILED_TOTALS });
    fireEvent.click(otherToggle());

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('Kategori 7')).toBeInTheDocument();
  });

  it('collapses Diğer again on a second click', () => {
    renderPie({ categories: EIGHT, totals: TAILED_TOTALS });
    fireEvent.click(otherToggle());
    fireEvent.click(screen.getByRole('button', { name: trStrings.pie.collapse }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps expanded slices in their own palette slots, not recoloured by rank', () => {
    const { container } = renderPie({ categories: EIGHT, totals: TAILED_TOTALS });
    fireEvent.click(otherToggle());
    expect(container.querySelector('path[data-slice="k7"]')?.getAttribute('fill'))
      .toBe(CATEGORY_PALETTE[7]);
  });

  it('offers no disclosure when nothing is folded', () => {
    renderPie();
    expect(screen.queryByRole('button', { name: new RegExp(trStrings.pie.other, 'u') }))
      .not.toBeInTheDocument();
  });

  it('says so when there is nothing to show', () => {
    renderPie({ totals: new Map() });
    expect(screen.getByText(trStrings.pie.empty)).toBeInTheDocument();
  });

  it('hides the svg from assistive technology, since the list carries the data', () => {
    const { container } = renderPie();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides its legend when asked, for use beside a category table', () => {
    const { container } = renderPie({ showLegend: false });
    expect(container.querySelectorAll('path[data-slice]')).toHaveLength(3);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('still draws its legend by default', () => {
    renderPie();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});
