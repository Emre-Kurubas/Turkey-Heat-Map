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
  metric: 'total',
  scaleMode: 'quantile',
};

const SCALE = createColorScale({
  values: [10, 40, 90, 250, 900],
  mode: 'quantile',
  ramp: 'spectral',
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

  it('renders one swatch per break', () => {
    const { container } = renderLegend();
    expect(container.querySelectorAll('[data-role="swatch"]').length).toBeGreaterThan(1);
  });

  it('shows a number beside every colour, because colour alone is not accessible', () => {
    const { container } = renderLegend();
    for (const swatch of container.querySelectorAll('[data-role="swatch"]')) {
      expect(swatch.textContent?.trim()).not.toBe('');
    }
  });

  it('names the active scale mode, so rank is never read as magnitude', () => {
    renderLegend();
    expect(screen.getByText(new RegExp(trStrings.scaleMode.quantile, 'u'))).toBeInTheDocument();
  });

  it('names the linear mode when that is active', () => {
    const linear = createColorScale({ values: [1, 2, 3], mode: 'linear', ramp: 'spectral' });
    renderLegend(linear, { ...base, scaleMode: 'linear' });
    expect(screen.getByText(new RegExp(trStrings.scaleMode.linear, 'u'))).toBeInTheDocument();
  });

  it('says "no data" for an empty domain rather than rendering an empty ramp', () => {
    const empty = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    renderLegend(empty);
    expect(screen.getByText(trStrings.legend.noData)).toBeInTheDocument();
  });

  it('collapses to a single swatch when every value is identical', () => {
    const flat = createColorScale({ values: [5, 5, 5], mode: 'quantile', ramp: 'spectral' });
    const { container } = renderLegend(flat);
    expect(container.querySelectorAll('[data-role="swatch"]')).toHaveLength(1);
  });

  it('paints each swatch with its break colour', () => {
    const { container } = renderLegend();
    const chip = container.querySelector('[data-role="swatch"] [data-role="chip"]');
    expect((chip as HTMLElement).style.background).not.toBe('');
  });
});
