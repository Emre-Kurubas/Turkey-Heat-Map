import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { createColorScale } from '@/core/color/index.js';
import { trStrings } from '@/i18n/index.js';
import { Legend } from './Legend.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  flyToRequest: null,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

const SCALE = createColorScale({
  values: [10, 40, 90, 250, 900],
  mode: 'quantile',
  ramp: 'ember',
});

function renderLegend(scale = SCALE, state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return render(<Legend scale={scale} />, { wrapper });
}

describe('Legend', () => {
  it('is labelled as a group', () => {
    renderLegend();
    expect(screen.getByRole('group', { name: trStrings.legend.title })).toBeInTheDocument();
  });

  it('renders the ramp as one continuous bar, not a row of buckets', () => {
    // Six discrete swatches told the reader the map had six colours. It has as
    // many as the ramp can produce, and the key has to say so.
    const { container } = renderLegend();
    const bar = container.querySelector<HTMLElement>('[data-role="ramp"]');
    expect(bar).not.toBeNull();
    expect(bar!.style.background).toContain('linear-gradient');
  });

  it('samples the gradient densely enough that no step is visible', () => {
    const { container } = renderLegend();
    const bar = container.querySelector('[data-role="ramp"]') as HTMLElement;
    const stops = bar.style.background.match(/#[\da-f]{6}/gu) ?? [];
    expect(stops.length).toBeGreaterThan(32);
  });

  it('samples the ramp itself rather than letting CSS interpolate', () => {
    // CSS gradients blend in sRGB; this ramp is built in OKLab. Two stops and a
    // browser blend would not be the colours the map is painted with.
    const scale = createColorScale({ values: [0, 50, 100], mode: 'linear', ramp: 'ember' });
    const { container } = renderLegend(scale);
    const bar = container.querySelector('[data-role="ramp"]') as HTMLElement;
    const stops = bar.style.background.match(/#[\da-f]{6}/gu) ?? [];
    expect(stops[0]).toBe(scale.ramp(0));
    expect(stops.at(-1)).toBe(scale.ramp(1));
  });

  it('shows numbers along the bar, because colour alone is not accessible', () => {
    const { container } = renderLegend();
    const ticks = container.querySelectorAll('[data-role="tick"]');
    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) expect(tick.textContent?.trim()).not.toBe('');
  });

  it('places each tick at its own position on the scale, not at even intervals', () => {
    // Under a quantile domain the top bucket can span most of the value range
    // while occupying a seventh of the bar. Evenly spaced labels would sit
    // above colours they do not name.
    const skewed = createColorScale({
      values: [1, 2, 3, 4, 5, 900], mode: 'quantile', ramp: 'ember',
    });
    const { container } = renderLegend(skewed);
    const lefts = [...container.querySelectorAll('[data-role="tick"]')]
      .map((tick) => Number.parseFloat((tick as HTMLElement).style.left));

    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    const gaps = lefts.slice(1).map((left, i) => left - lefts[i]!);
    expect(Math.max(...gaps)).toBeGreaterThan(Math.min(...gaps) * 1.5);
  });

  it('names the active scale mode, so rank is never read as magnitude', () => {
    renderLegend();
    expect(screen.getByText(new RegExp(trStrings.scaleMode.quantile, 'u'))).toBeInTheDocument();
  });

  it('names the linear mode when that is active', () => {
    const linear = createColorScale({ values: [1, 2, 3], mode: 'linear', ramp: 'ember' });
    renderLegend(linear, { ...base, scaleMode: 'linear' });
    expect(screen.getByText(new RegExp(trStrings.scaleMode.linear, 'u'))).toBeInTheDocument();
  });

  it('says "no data" for an empty domain rather than rendering an empty ramp', () => {
    const empty = createColorScale({ values: [], mode: 'quantile', ramp: 'ember' });
    renderLegend(empty);
    expect(screen.getByText(trStrings.legend.noData)).toBeInTheDocument();
  });

  it('still names the single value when every region is identical', () => {
    const flat = createColorScale({ values: [5, 5, 5], mode: 'quantile', ramp: 'ember' });
    const { container } = renderLegend(flat);
    const ticks = [...container.querySelectorAll('[data-role="tick"]')];
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) expect(tick.textContent).toContain('5');
  });

  it('sits on a panel, so its text never lands on the map it describes', () => {
    renderLegend();
    const group = screen.getByRole('group', { name: trStrings.legend.title });
    expect(group.className).toMatch(/panel/u);
  });
});
