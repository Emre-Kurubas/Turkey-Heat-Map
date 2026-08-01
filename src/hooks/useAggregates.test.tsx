import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { useAggregates } from './useAggregates.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'hirsizlik', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'darp', count: 10 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2021], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function setup(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

const INPUT = { data: DATA, categories: CATEGORIES, colorScale: 'spectral' } as const;

describe('useAggregates', () => {
  it('rolls up totals for the active level', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
    expect(result.current.rollup.byRegion.get('06')?.total).toBe(40);
  });

  it('narrows to the filtered year range', () => {
    const { wrapper } = setup({ ...base, filters: { yearRange: [2021, 2021], categories: [] } });
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(10);
    expect(result.current.rollup.byRegion.has('06')).toBe(false);
  });

  it('switches to district codes at ilçe level', () => {
    const { wrapper } = setup({ ...base, level: 'ilce' });
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.rollup.byRegion.get('3401')?.total).toBe(110);
  });

  it('builds a colour scale over the rollup values', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.scale.domain.min).toBe(40);
    expect(result.current.scale.domain.max).toBe(110);
    expect(result.current.scale(110)).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('resolves region names from the bundled geography', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.names.get('34')).toBe('İstanbul');
  });

  it('does not rebuild the index when only the transform moves', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    const before = result.current.index;

    act(() => { store.dispatch({ type: 'setTransform', transform: { k: 4, x: 1, y: 2 } }); });
    expect(result.current.index).toBe(before);
  });

  it('rebuilds the rollup when filters change', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    const before = result.current.rollup;

    act(() => {
      store.dispatch({
        type: 'setFilters',
        filters: { yearRange: [2021, 2021], categories: [] },
      });
    });
    expect(result.current.rollup).not.toBe(before);
  });

  it('surfaces validation warnings instead of throwing on bad records', () => {
    const bad: CrimeRecord[] = [
      { year: 2020, ilCode: '99', category: 'hirsizlik', count: 5 },
    ];
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: bad, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.index.warnings.length).toBeGreaterThan(0);
    expect(result.current.rollup.total).toBe(0);
  });

  it('survives an empty dataset', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: [], categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );
    expect(result.current.rollup.total).toBe(0);
    expect(() => result.current.scale(0)).not.toThrow();
  });
});
