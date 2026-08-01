import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { totalsByYear } from './yearSeries.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'a', count: 60 },
  { year: 2020, ilCode: '34', ilceCode: '3402', category: 'b', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'a', count: 100 },
  { year: 2021, ilCode: '06', ilceCode: '0601', category: 'b', count: 7 },
  { year: 2022, ilCode: '06', ilceCode: '0601', category: 'a', count: 10 },
];

const index = buildIndex({ data: DATA, categories: CATEGORIES });

describe('totalsByYear', () => {
  it('totals every year in the data', () => {
    expect([...totalsByYear(index, { categories: [] })].sort()).toEqual([
      [2020, 100], [2021, 107], [2022, 10],
    ]);
  });

  it('treats an empty category list as every category', () => {
    // The FilterSet convention. Reading it as "none" would return an empty
    // chart for the default, unfiltered view.
    expect(totalsByYear(index, { categories: [] }).get(2020)).toBe(100);
  });

  it('applies a category filter', () => {
    const out = totalsByYear(index, { categories: ['a'] });
    expect(out.get(2020)).toBe(60);
    expect(out.get(2021)).toBe(100);
  });

  it('drops a year entirely when the filter leaves it nothing', () => {
    // Rather than emitting a zero: the chart would then plot a point at the
    // baseline for a year that has no records under this filter at all.
    const out = totalsByYear(index, { categories: ['b'] });
    expect(out.has(2022)).toBe(false);
  });

  it('restricts to one province when asked', () => {
    const out = totalsByYear(index, { categories: [], region: { level: 'il', code: '34' } });
    expect([...out].sort()).toEqual([[2020, 100], [2021, 100]]);
  });

  it('restricts to one district when asked', () => {
    const out = totalsByYear(index, {
      categories: [], region: { level: 'ilce', code: '3401' },
    });
    expect([...out].sort()).toEqual([[2020, 60], [2021, 100]]);
  });

  it('combines a region and a category filter', () => {
    const out = totalsByYear(index, {
      categories: ['a'], region: { level: 'il', code: '34' },
    });
    expect([...out].sort()).toEqual([[2020, 60], [2021, 100]]);
  });

  it('returns nothing for a region the data never mentions', () => {
    expect(totalsByYear(index, { categories: [], region: { level: 'il', code: '01' } }).size)
      .toBe(0);
  });

  it('is empty for an empty index', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    expect(totalsByYear(empty, { categories: [] }).size).toBe(0);
  });

  it('ignores the year range, which is the whole point', () => {
    // There is no year-range parameter to pass. The trend chart is the control
    // that sets that filter, and a selector filtered by its own selection would
    // collapse to a single point with no way back.
    const out = totalsByYear(index, { categories: [] });
    expect(out.size).toBe(3);
  });
});
