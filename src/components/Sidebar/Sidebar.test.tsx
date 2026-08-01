import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import { createColorScale } from '@/core/color/index.js';
import { trStrings } from '@/i18n/index.js';
import { Sidebar } from './Sidebar.js';

const ROWS: RankedRegion[] = [
  { code: '34', name: 'İstanbul', total: 900, share: 0.6, rank: 1 },
  { code: '06', name: 'Ankara', total: 400, share: 0.27, rank: 2 },
  { code: '35', name: 'İzmir', total: 200, share: 0.13, rank: 3 },
];
const SCALE = createColorScale({ values: [900, 400, 200], mode: 'quantile', ramp: 'spectral' });

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

/**
 * jsdom reports clientHeight as 0, so the virtual window would be empty. Stub a
 * real height on the scroller so rows actually render.
 */
function stubScrollerHeight(container: HTMLElement, height = 400): void {
  const scroller = container.querySelector('[class*="scroller"]');
  if (scroller === null) return;
  Object.defineProperty(scroller, 'clientHeight', { value: height, configurable: true });
}

function renderSidebar(rows: RankedRegion[] = ROWS, state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const hoverStore = createHoverStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<Sidebar rows={rows} scale={SCALE} />, { wrapper });
  stubScrollerHeight(utils.container);
  utils.rerender(<Sidebar rows={rows} scale={SCALE} />);
  return { ...utils, store, hoverStore };
}

describe('Sidebar', () => {
  it('is labelled as a group', () => {
    renderSidebar();
    expect(screen.getByRole('group', { name: trStrings.sidebar.title })).toBeInTheDocument();
  });

  it('renders a row per region with name, count and share', () => {
    renderSidebar();
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('%60,0')).toBeInTheDocument();
  });

  it('says so when there is nothing to list', () => {
    renderSidebar([]);
    expect(screen.getByText(trStrings.sidebar.empty)).toBeInTheDocument();
  });

  it('requests a fly-to when a row is clicked', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /İstanbul/u }));
    expect(store.getState().flyToRequest).toBe('34');
  });

  it('selects the region it flew to', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Ankara/u }));
    expect(store.getState().selectedCode).toBe('06');
  });

  it('highlights the map region on row hover, tagged as a list hover', () => {
    const { hoverStore } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İzmir/u }));
    expect(hoverStore.getState()).toEqual({ code: '35', x: 0, y: 0, source: 'list' });
  });

  it('clears the highlight on row leave', () => {
    const { hoverStore } = renderSidebar();
    const row = screen.getByRole('button', { name: /İzmir/u });
    fireEvent.pointerEnter(row);
    fireEvent.pointerLeave(row);
    expect(hoverStore.getState()).toBeNull();
  });

  it('marks the row matching a hover, so the link works in both directions', () => {
    const { container } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İstanbul/u }));
    expect(container.querySelector('[data-hovered="true"]')?.textContent)
      .toContain('İstanbul');
  });

  it('marks the selected row as current', () => {
    const selected: HeatMapState = { ...base, selectedCode: '06' };
    renderSidebar(ROWS, selected);
    expect(screen.getByRole('button', { name: /Ankara/u })).toHaveAttribute('aria-current', 'true');
  });

  it('sorts by name when asked', () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.sortByName }));

    const names = [...container.querySelectorAll('[data-role="row"]')]
      .map((row) => row.textContent ?? '');
    expect(names[0]).toContain('Ankara');
  });

  it('collapses to a rail and back', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));
    expect(screen.queryByText('İstanbul')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.expand }));
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
  });

  it('tints each row bar with that region heat colour', () => {
    const { container } = renderSidebar();
    const bar = container.querySelector('[data-role="bar"]') as HTMLElement;
    expect(bar.style.background).not.toBe('');
  });

  it('renders only a window of rows for a long list', () => {
    const many: RankedRegion[] = Array.from({ length: 973 }, (_, i) => ({
      code: String(i).padStart(4, '0'),
      name: `Bölge ${i}`,
      total: 973 - i,
      share: 0.001,
      rank: i + 1,
    }));
    const { container } = renderSidebar(many);

    const rendered = container.querySelectorAll('[data-role="row"]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(973);
  });

  it('reserves the full scroll height even though it renders a window', () => {
    const many: RankedRegion[] = Array.from({ length: 973 }, (_, i) => ({
      code: String(i).padStart(4, '0'),
      name: `Bölge ${i}`,
      total: 1,
      share: 0.001,
      rank: i + 1,
    }));
    const { container } = renderSidebar(many);
    const spacer = container.querySelector('[class*="spacer"]') as HTMLElement;
    expect(spacer.style.height).toBe(`${973 * 26}px`);
  });
});
