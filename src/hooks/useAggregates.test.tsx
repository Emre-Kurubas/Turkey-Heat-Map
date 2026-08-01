import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord, RegionPopulation } from '@/core/types/index.js';
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
  defaultFilters: { yearRange: [2020, 2021], categories: [] },
  yearBounds: [2020, 2021],
  flyToRequest: null,
  detail: null,
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

  it('builds the colour scale over district values even at province zoom', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });

    // Provinces total 110 and 40; the districts carrying them total the same
    // here, so the domain matches — but it comes from heatRollup, not rollup.
    expect(result.current.heatLevel).toBe('ilce');
    expect(result.current.heatRollup.byRegion.get('3401')?.total).toBe(110);
    expect(result.current.scale.domain.min).toBe(40);
    expect(result.current.scale.domain.max).toBe(110);
    expect(result.current.scale(110)).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('keeps the heat at district level while the outline level is provinces', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });

    expect([...result.current.rollup.byRegion.keys()]).toContain('34');
    expect([...result.current.heatRollup.byRegion.keys()]).toContain('3401');
  });

  it('reuses one rollup when the outline and heat levels agree', () => {
    const { wrapper } = setup({ ...base, level: 'ilce' });
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.heatRollup).toBe(result.current.rollup);
  });

  /**
   * An ilçe rollup of il-only records is empty, which would paint the entire
   * map as no-data. The heat has to drop to provinces for such a dataset.
   */
  it('falls back to province heat when the data carries no district codes', () => {
    const ilOnly: CrimeRecord[] = [
      { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
      { year: 2020, ilCode: '06', category: 'hirsizlik', count: 40 },
    ];
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ data: ilOnly, categories: CATEGORIES, colorScale: 'spectral' }),
      { wrapper },
    );

    expect(result.current.heatLevel).toBe('il');
    expect(result.current.heatRollup.total).toBe(140);
    expect(result.current.scale.domain.max).toBe(100);
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

const POPULATION: RegionPopulation[] = [
  { ilCode: '34', ilceCode: '3401', year: 2020, population: 1_000_000 },
  { ilCode: '06', ilceCode: '0601', year: 2020, population: 500_000 },
  { ilCode: '34', ilceCode: '3401', year: 2021, population: 1_000_000 },
  { ilCode: '06', ilceCode: '0601', year: 2021, population: 500_000 },
];

describe('useAggregates — per-capita metric', () => {
  it('leaves totals alone while the metric is total', () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
  });

  it('restates totals as a rate once the metric is per-capita', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    // 110 per 1,000,000 residents is 11 per 100,000.
    expect(result.current.rollup.byRegion.get('34')?.total).toBeCloseTo(11);
  });

  it('falls back to totals when per-capita is asked for with no population', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(() => useAggregates(INPUT), { wrapper });
    expect(result.current.rollup.byRegion.get('34')?.total).toBe(110);
  });

  it('builds the colour scale from the rate, so the legend matches the map', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    expect(result.current.scale.domain.max).toBeLessThan(110);
  });

  it('reorders regions by rate, which is the whole point of the metric', () => {
    const { wrapper } = setup({ ...base, metric: 'perCapita' });
    const { result } = renderHook(
      () => useAggregates({ ...INPUT, population: POPULATION }),
      { wrapper },
    );
    // 110/1M = 11 per 100k; 40/500k = 8 per 100k.
    const istanbul = result.current.rollup.byRegion.get('34')!.total;
    const ankara = result.current.rollup.byRegion.get('06')!.total;
    expect(istanbul).toBeCloseTo(11);
    expect(ankara).toBeCloseTo(8);
  });
});
