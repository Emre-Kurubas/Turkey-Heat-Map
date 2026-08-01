import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { diffRollups } from './diff.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

const DATA: CrimeRecord[] = [
  { year: 2022, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2023, ilCode: '34', category: 'hirsizlik', count: 150 },
  { year: 2022, ilCode: '06', category: 'hirsizlik', count: 200 },
  { year: 2023, ilCode: '06', category: 'hirsizlik', count: 120 },
  { year: 2023, ilCode: '19', category: 'hirsizlik', count: 40 },
];

const INDEX = buildIndex({ data: DATA, categories: CATEGORIES });
const year = (y: number): FilterSet => ({ yearRange: [y, y], categories: [] });

const A = rollup(INDEX, 'il', year(2023));
const B = rollup(INDEX, 'il', year(2022));
const DIFF = diffRollups(A, B);

describe('diffRollups', () => {
  it('computes delta as A minus B', () => {
    expect(DIFF.byRegion.get('34')?.delta).toBe(50);
    expect(DIFF.byRegion.get('06')?.delta).toBe(-80);
  });

  it('computes the percentage change relative to B', () => {
    expect(DIFF.byRegion.get('34')?.pctDelta).toBeCloseTo(0.5, 6);
    expect(DIFF.byRegion.get('06')?.pctDelta).toBeCloseTo(-0.4, 6);
  });

  it('carries both sides through for the tooltip', () => {
    const istanbul = DIFF.byRegion.get('34')!;
    expect(istanbul.a).toBe(150);
    expect(istanbul.b).toBe(100);
    expect(istanbul.code).toBe('34');
  });

  it('includes regions present in only one side', () => {
    // Çorum appears in 2023 but not 2022. Dropping it would hide a new hotspot.
    const corum = DIFF.byRegion.get('19')!;
    expect(corum.a).toBe(40);
    expect(corum.b).toBe(0);
    expect(corum.delta).toBe(40);
  });

  it('returns null pctDelta when the baseline is zero', () => {
    // Growth from nothing has no ratio. Infinity would render as nonsense.
    expect(DIFF.byRegion.get('19')?.pctDelta).toBeNull();
  });

  it('returns zero pctDelta when both sides are zero', () => {
    const zeroed = buildIndex({
      data: [
        { year: 2022, ilCode: '34', category: 'hirsizlik', count: 0 },
        { year: 2023, ilCode: '34', category: 'hirsizlik', count: 0 },
      ],
      categories: CATEGORIES,
    });
    const diff = diffRollups(
      rollup(zeroed, 'il', year(2023)),
      rollup(zeroed, 'il', year(2022)),
    );
    expect(diff.byRegion.get('34')?.delta).toBe(0);
    expect(diff.byRegion.get('34')?.pctDelta).toBe(0);
  });

  it('reports the largest absolute delta for the color scale', () => {
    expect(DIFF.maxAbsDelta).toBe(80);
  });

  it('reports both totals', () => {
    expect(DIFF.totalA).toBe(310);
    expect(DIFF.totalB).toBe(300);
  });

  it('handles an empty A side', () => {
    const diff = diffRollups(rollup(INDEX, 'il', year(1990)), B);
    expect(diff.byRegion.get('34')?.a).toBe(0);
    expect(diff.byRegion.get('34')?.delta).toBe(-100);
    expect(diff.totalA).toBe(0);
  });

  it('handles an empty B side', () => {
    const diff = diffRollups(A, rollup(INDEX, 'il', year(1990)));
    expect(diff.byRegion.get('34')?.delta).toBe(150);
    expect(diff.byRegion.get('34')?.pctDelta).toBeNull();
  });

  it('handles both sides empty', () => {
    const empty = rollup(INDEX, 'il', year(1990));
    const diff = diffRollups(empty, empty);
    expect(diff.byRegion.size).toBe(0);
    expect(diff.maxAbsDelta).toBe(0);
  });
});
