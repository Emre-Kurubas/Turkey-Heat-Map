import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { useRegionDetail } from './useRegionDetail.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'a', count: 60 },
  { year: 2020, ilCode: '34', ilceCode: '3402', category: 'b', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'a', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'a', count: 10 },
];

const index = buildIndex({ data: DATA, categories: CATEGORIES });
const FILTERS: FilterSet = { yearRange: [2020, 2021], categories: [] };

describe('useRegionDetail', () => {
  it('returns nothing when no region is open', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, null),
    );
    expect(result.current).toBeNull();
  });

  it('totals a province across all of its districts', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current?.total).toBe(200);
  });

  it('names the region from the shipped geography', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current?.name).toBe('İstanbul');
  });

  /**
   * The case the whole hook exists for: the map is showing districts, but the
   * open panel belongs to a province.
   */
  it('rolls up at the target level, not the map level', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '3401', level: 'ilce' }),
    );
    expect(result.current?.name).toBe('Adalar');
    expect(result.current?.total).toBe(160);
  });

  it('breaks the total down by category, largest first', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    const cats = result.current!.categories;
    expect(cats[0]).toMatchObject({ id: 'a', label: 'Hırsızlık', value: 160 });
    expect(cats[1]).toMatchObject({ id: 'b', label: 'Darp', value: 40 });
  });

  it('computes each category share against the region total', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current!.categories[0]!.share).toBeCloseTo(0.8);
  });

  it('omits categories with no records in this region', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '06', level: 'il' }),
    );
    expect(result.current!.categories.map((c) => c.id)).toEqual(['a']);
  });

  it('breaks the total down by year', () => {
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    expect(result.current!.byYear.get(2020)).toBe(100);
    expect(result.current!.byYear.get(2021)).toBe(100);
  });

  it('honours the active filters', () => {
    const narrowed: FilterSet = { yearRange: [2021, 2021], categories: [] };
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, narrowed, { code: '34', level: 'il' }),
    );
    expect(result.current?.total).toBe(100);
  });

  it('returns a zeroed record for a region with no data rather than null', () => {
    // The panel was opened deliberately; saying "0" is a better answer than
    // silently refusing to open.
    const { result } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '35', level: 'il' }),
    );
    expect(result.current?.total).toBe(0);
    expect(result.current?.name).toBe('İzmir');
    expect(result.current?.categories).toEqual([]);
  });

  it('is stable across renders with the same inputs', () => {
    const { result, rerender } = renderHook(
      () => useRegionDetail(index, CATEGORIES, FILTERS, { code: '34', level: 'il' }),
    );
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
