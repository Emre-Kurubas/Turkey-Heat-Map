import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { TrendChart } from './TrendChart.js';

const BY_YEAR = new Map([
  [2018, 100], [2019, 140], [2020, 90], [2021, 200], [2022, 160],
]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2019, 2021], categories: [] },
  defaultFilters: { yearRange: [2018, 2022], categories: [] },
  yearBounds: [2018, 2022],
  flyToRequest: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderTrend(state: HeatMapState = base, byYear = BY_YEAR) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<TrendChart byYear={byYear} />, { wrapper });
  return { ...utils, store };
}

describe('TrendChart', () => {
  it('is labelled as a group', () => {
    renderTrend();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });

  it('draws a line and a shaded area', () => {
    const { container } = renderTrend();
    expect(container.querySelector('[data-role="line"]')).not.toBeNull();
    expect(container.querySelector('[data-role="area"]')).not.toBeNull();
  });

  it('plots one marker per year', () => {
    const { container } = renderTrend();
    expect(container.querySelectorAll('[data-role="marker"]')).toHaveLength(5);
  });

  it('dims the years outside the active filter range', () => {
    const { container } = renderTrend();
    // 2018 and 2022 sit outside [2019, 2021].
    expect(container.querySelectorAll('[data-role="marker"][data-active="false"]'))
      .toHaveLength(2);
  });

  it('sets the filter to a single year when one is clicked', () => {
    const { container, store } = renderTrend();
    fireEvent.click(container.querySelector('[data-role="hit"][data-year="2020"]')!);
    expect(store.getState().filters.yearRange).toEqual([2020, 2020]);
  });

  it('shows a guide and value on hover', () => {
    const { container } = renderTrend();
    fireEvent.pointerEnter(container.querySelector('[data-role="hit"][data-year="2021"]')!);

    expect(container.querySelector('[data-role="guide"]')).not.toBeNull();
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
  });

  it('clears the guide on leave', () => {
    const { container } = renderTrend();
    const hit = container.querySelector('[data-role="hit"][data-year="2021"]')!;
    fireEvent.pointerEnter(hit);
    fireEvent.pointerLeave(hit);
    expect(container.querySelector('[data-role="guide"]')).toBeNull();
  });

  it('exposes the series as a table for screen readers', () => {
    renderTrend();
    // One header row plus one per year.
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('says so when there is nothing to plot', () => {
    renderTrend(base, new Map());
    expect(screen.getByText(trStrings.trend.empty)).toBeInTheDocument();
  });

  it('survives a single-year dataset without dividing by zero', () => {
    const { container } = renderTrend(base, new Map([[2020, 50]]));
    const marker = container.querySelector('[data-role="marker"]');
    expect(marker).not.toBeNull();
    expect(Number(marker?.getAttribute('cx'))).not.toBeNaN();
  });

  it('keeps every plotted point inside the chart box', () => {
    const { container } = renderTrend();
    for (const marker of container.querySelectorAll('[data-role="marker"]')) {
      const cy = Number(marker.getAttribute('cy'));
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(84);
    }
  });
});
