import { describe, expect, it } from 'vitest';
import { generateMockData } from '@/data/mock/index.js';
import { IL_BY_CODE } from '@/data/geo/region-meta.js';
import type { FilterSet } from '@/core/types/index.js';
import { buildIndex, diffRollups, rankRegions, rollup } from './index.js';

/**
 * Guards the spec's performance budget: a filter change must update every panel
 * in under 100 ms, and aggregation is the dominant cost inside that budget.
 *
 * Thresholds are deliberately loose — roughly 5x the expected time — so this
 * catches genuine algorithmic regressions (an accidental O(n²), a rebuild of the
 * index on every filter change) without failing on a slow CI runner.
 */
describe('aggregation performance at realistic scale', () => {
  const { records, categories } = generateMockData();
  const names = new Map([...IL_BY_CODE].map(([code, meta]) => [code, meta.name]));
  const ALL: FilterSet = { yearRange: [2015, 2024], categories: [] };

  it('generates a dataset of realistic size', () => {
    // Sanity check: if this shrinks, the timings below stop meaning anything.
    expect(records.length).toBeGreaterThan(50_000);
  });

  it('builds the index in under 500 ms', () => {
    const started = performance.now();
    buildIndex({ data: records, categories });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('rolls up in under 100 ms at il level', () => {
    const index = buildIndex({ data: records, categories });
    const started = performance.now();
    rollup(index, 'il', ALL);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('rolls up in under 100 ms at ilçe level', () => {
    const index = buildIndex({ data: records, categories });
    const started = performance.now();
    rollup(index, 'ilce', ALL);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('completes a full filter-change cycle in under 150 ms', () => {
    // The realistic hot path: roll up, rank the sidebar, diff against a
    // comparison range. The index is built once and reused, as in the real app.
    const index = buildIndex({ data: records, categories });
    const started = performance.now();

    const a = rollup(index, 'il', { yearRange: [2020, 2024], categories: ['hirsizlik'] });
    const b = rollup(index, 'il', { yearRange: [2015, 2019], categories: ['hirsizlik'] });
    rankRegions(a, { sort: 'total-desc', names });
    diffRollups(a, b);

    expect(performance.now() - started).toBeLessThan(150);
  });

  it('scales roughly linearly rather than quadratically', () => {
    // A quadratic regression would blow past 4x when the data quadruples.
    const small = generateMockData({ years: [2020, 2021] });
    const large = generateMockData({ years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] });

    const time = (data: typeof small): number => {
      const index = buildIndex({ data: data.records, categories: data.categories });
      const started = performance.now();
      rollup(index, 'ilce', { yearRange: [2015, 2024], categories: [] });
      return performance.now() - started;
    };

    const smallTime = Math.max(time(small), 1);
    const largeTime = time(large);
    expect(largeTime / smallTime).toBeLessThan(12);
  });
});
