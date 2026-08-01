import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { Attribution } from './Attribution.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderAttribution() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  return render(<Attribution />, { wrapper });
}

describe('Attribution', () => {
  it('credits OpenStreetMap, which the ODbL licence requires', () => {
    renderAttribution();
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });

  it('names the ODbL licence', () => {
    renderAttribution();
    expect(screen.getByText(/ODbL/u)).toBeInTheDocument();
  });

  it('has an accessible name', () => {
    renderAttribution();
    expect(screen.getByRole('note', { name: trStrings.attribution.label })).toBeInTheDocument();
  });
});
