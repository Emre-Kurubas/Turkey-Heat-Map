import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { buildIndex, rollup } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { HoverTooltip } from './HoverTooltip.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 900 },
  { year: 2020, ilCode: '34', category: 'darp', count: 300 },
  { year: 2021, ilCode: '34', category: 'hirsizlik', count: 1200 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2021], categories: [] },
  defaultFilters: { yearRange: [2020, 2021], categories: [] },
  yearBounds: [2020, 2021],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

const NAMES = new Map([['34', 'İstanbul'], ['06', 'Ankara']]);

function setup() {
  const hoverStore = createHoverStore();
  const store = createHeatMapStore(base);
  const rolled = rollup(buildIndex({ data: DATA, categories: CATEGORIES }), 'il', base.filters);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <HoverTooltip rollup={rolled} names={NAMES} categories={CATEGORIES} />,
    { wrapper },
  );
  return { ...utils, hoverStore };
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe('HoverTooltip', () => {
  it('renders nothing when nothing is hovered', () => {
    setup();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays hidden during the anti-flicker delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('appears after the delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('names the hovered region and shows its total', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });

    expect(screen.getByText('İstanbul')).toBeInTheDocument();
    // 900 + 300 + 1200, grouped tr-TR.
    expect(screen.getByText('2.400')).toBeInTheDocument();
  });

  it('lists the top categories with their labels', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByText('Hırsızlık')).toBeInTheDocument();
    expect(screen.getByText('Darp')).toBeInTheDocument();
  });

  it('hides immediately on leave, with no trailing delay', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });
    act(() => { hoverStore.dispatch({ type: 'leave' }); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says "no data" for a region absent from the rollup', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '06', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });
    expect(screen.getByText(trStrings.tooltip.noData)).toBeInTheDocument();
  });

  it('mirrors its content into a live region for screen readers', () => {
    const { container, hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('İstanbul');
  });

  it('cancels a pending show if the pointer leaves first', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { hoverStore.dispatch({ type: 'leave' }); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('follows the cursor', () => {
    const { hoverStore } = setup();
    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 10, y: 10, source: 'map' } }); });
    act(() => { vi.advanceTimersByTime(80); });
    const first = screen.getByRole('tooltip').style.transform;

    act(() => { hoverStore.dispatch({ type: 'move', x: 300, y: 200 }); });
    expect(screen.getByRole('tooltip').style.transform).not.toBe(first);
  });
});
