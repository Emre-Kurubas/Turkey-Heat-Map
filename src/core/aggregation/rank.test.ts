import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { rankRegions } from './rank.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

const DATA: CrimeRecord[] = [
  { year: 2023, ilCode: '34', category: 'hirsizlik', count: 500 },
  { year: 2023, ilCode: '06', category: 'hirsizlik', count: 300 },
  { year: 2023, ilCode: '19', category: 'hirsizlik', count: 200 },
];

const NAMES = new Map([['34', 'İstanbul'], ['06', 'Ankara'], ['19', 'Çorum']]);
const RESULT = rollup(
  buildIndex({ data: DATA, categories: CATEGORIES }),
  'il',
  { yearRange: [2023, 2023], categories: [] },
);

describe('rankRegions', () => {
  it('sorts by total descending by default', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: NAMES });
    expect(ranked.map((r) => r.code)).toEqual(['34', '06', '19']);
  });

  it('sorts by total ascending', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-asc', names: NAMES });
    expect(ranked.map((r) => r.code)).toEqual(['19', '06', '34']);
  });

  it('sorts by name using Turkish collation', () => {
    const ranked = rankRegions(RESULT, { sort: 'name-asc', names: NAMES });
    expect(ranked.map((r) => r.name)).toEqual(['Ankara', 'Çorum', 'İstanbul']);
  });

  it('sorts by name descending', () => {
    const ranked = rankRegions(RESULT, { sort: 'name-desc', names: NAMES });
    expect(ranked.map((r) => r.name)).toEqual(['İstanbul', 'Çorum', 'Ankara']);
  });

  it('computes each region share of the total', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: NAMES });
    expect(ranked[0]!.share).toBeCloseTo(0.5, 6);
    expect(ranked[1]!.share).toBeCloseTo(0.3, 6);
    expect(ranked.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 6);
  });

  it('keeps rank tied to total regardless of the active sort', () => {
    // The sidebar shows "3." next to Çorum even when sorted alphabetically.
    const byName = rankRegions(RESULT, { sort: 'name-asc', names: NAMES });
    expect(byName.find((r) => r.code === '34')!.rank).toBe(1);
    expect(byName.find((r) => r.code === '19')!.rank).toBe(3);
  });

  it('gives tied totals distinct but stable ranks', () => {
    const tied = rollup(
      buildIndex({
        data: [
          { year: 2023, ilCode: '34', category: 'hirsizlik', count: 100 },
          { year: 2023, ilCode: '06', category: 'hirsizlik', count: 100 },
        ],
        categories: CATEGORIES,
      }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    const ranked = rankRegions(tied, { sort: 'total-desc', names: NAMES });
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
    // Ties break alphabetically, so the order is reproducible across renders.
    expect(ranked[0]!.name).toBe('Ankara');
  });

  it('falls back to the code when a name is missing', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: new Map() });
    expect(ranked[0]!.name).toBe('34');
  });

  it('returns zero shares rather than NaN when the total is zero', () => {
    const empty = rollup(
      buildIndex({
        data: [{ year: 2023, ilCode: '34', category: 'hirsizlik', count: 0 }],
        categories: CATEGORIES,
      }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    const ranked = rankRegions(empty, { sort: 'total-desc', names: NAMES });
    expect(ranked[0]!.share).toBe(0);
  });

  it('returns an empty array for an empty rollup', () => {
    const empty = rollup(
      buildIndex({ data: [], categories: CATEGORIES }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    expect(rankRegions(empty, { sort: 'total-desc', names: NAMES })).toEqual([]);
  });
});
