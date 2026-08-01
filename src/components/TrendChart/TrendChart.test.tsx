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
  viewResetRequest: 0,
  detail: null,
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

  it('draws the series as a line', () => {
    const { container } = renderTrend();
    expect(container.querySelector('[data-role="line"]')).not.toBeNull();
  });

  it('draws both axes', () => {
    const { container } = renderTrend();
    expect(container.querySelector('[data-role="axis-x"]')).not.toBeNull();
    expect(container.querySelector('[data-role="axis-y"]')).not.toBeNull();
  });

  it('rules a gridline for every year and every y tick', () => {
    const { container } = renderTrend();
    // Five years, plus five horizontal ticks (four divisions and the baseline).
    expect(container.querySelectorAll('[data-role="grid"]')).toHaveLength(10);
  });

  it('labels the y axis from zero up to the rounded maximum', () => {
    const { container } = renderTrend();
    const labels = [...container.querySelectorAll('[data-role="y-label"]')]
      .map((node) => node.textContent);
    // niceMax rounds 200 up to 200, quartered.
    expect(labels).toEqual(['0', '50', '100', '150', '200']);
  });

  it('drops a y label rather than printing the same number twice', () => {
    // Every year at zero collapses the axis to a maximum of 1, whose quarters
    // all round to 0 or 1. The gridlines stay; the duplicate numbers go.
    const { container } = renderTrend(base, new Map([[2020, 0], [2021, 0]]));
    const labels = [...container.querySelectorAll('[data-role="y-label"]')]
      .map((node) => node.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(container.querySelectorAll('[data-role="grid"]')).toHaveLength(7);
  });

  it('labels the x axis with the years themselves', () => {
    const { container } = renderTrend();
    const labels = [...container.querySelectorAll('[data-role="x-label"]')]
      .map((node) => node.textContent);
    expect(labels).toEqual(['2018', '2019', '2020', '2021', '2022']);
  });

  it('thins the x labels rather than overprinting them on a long series', () => {
    // Twenty years cannot each carry a legible label under a 300px axis.
    const long = new Map(
      Array.from({ length: 20 }, (_, i) => [2005 + i, 100 + i] as const),
    );
    const { container } = renderTrend(base, long);
    // Every year still gets its gridline — twenty of them, plus the five y ticks.
    expect(container.querySelectorAll('[data-role="grid"]')).toHaveLength(25);
    expect(container.querySelectorAll('[data-role="x-label"]')).toHaveLength(10);
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

  it('keeps every plotted point inside the plot area, clear of the axes', () => {
    const { container } = renderTrend();
    for (const marker of container.querySelectorAll('[data-role="marker"]')) {
      // PAD_TOP .. BASELINE and PAD_LEFT .. PLOT_RIGHT: a point outside these
      // would be drawn over an axis label or off the canvas entirely.
      const cy = Number(marker.getAttribute('cy'));
      const cx = Number(marker.getAttribute('cx'));
      expect(cy).toBeGreaterThanOrEqual(14);
      expect(cy).toBeLessThanOrEqual(142);
      expect(cx).toBeGreaterThanOrEqual(38);
      expect(cx).toBeLessThanOrEqual(324);
    }
  });

  it('reads out the hovered year and its value', () => {
    const { container } = renderTrend();
    fireEvent.pointerEnter(container.querySelector('[data-role="hit"][data-year="2019"]')!);
    expect(screen.getAllByText('140').length).toBeGreaterThan(0);
  });
});

describe('TrendChart — picking a year', () => {
  /** The filter narrowed to 2020, as a click on that point would leave it. */
  const isolated: HeatMapState = {
    ...base,
    filters: { yearRange: [2020, 2020], categories: [] },
  };

  it('keeps every year on the chart while one is selected', () => {
    // The series it plots spans the whole dataset regardless of the filter —
    // a year selector filtered by its own selection would leave one point and
    // no way back. See totalsByYear.
    const { container } = renderTrend(isolated);
    expect(container.querySelectorAll('[data-role="marker"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-role="hit"]')).toHaveLength(5);
  });

  it('marks the isolated year, so the pick is visible on the chart', () => {
    const { container } = renderTrend(isolated);
    const selected = container.querySelectorAll('[data-role="marker"][data-selected="true"]');
    expect(selected).toHaveLength(1);
  });

  it('marks nothing as isolated while a span is selected', () => {
    const { container } = renderTrend();
    expect(container.querySelectorAll('[data-role="marker"][data-selected="true"]'))
      .toHaveLength(0);
  });

  it('moves straight to another year in one click', () => {
    const { container, store } = renderTrend(isolated);
    fireEvent.click(container.querySelector('[data-role="hit"][data-year="2022"]')!);
    expect(store.getState().filters.yearRange).toEqual([2022, 2022]);
  });

  it('gives every year back when the selected one is clicked again', () => {
    const { container, store } = renderTrend(isolated);
    fireEvent.click(container.querySelector('[data-role="hit"][data-year="2020"]')!);
    expect(store.getState().filters.yearRange).toEqual(base.yearBounds);
  });

  it('does not treat a click inside a wider range as a second click', () => {
    // The range is [2019, 2021] here, so 2020 is inside it but not isolated by
    // it. That click has to narrow, not widen.
    const { container, store } = renderTrend();
    fireEvent.click(container.querySelector('[data-role="hit"][data-year="2020"]')!);
    expect(store.getState().filters.yearRange).toEqual([2020, 2020]);
  });

  it('dims the years outside the selection without hiding them', () => {
    const { container } = renderTrend(isolated);
    const dimmed = container.querySelectorAll('[data-role="marker"][data-active="false"]');
    expect(dimmed).toHaveLength(4);
  });
});
