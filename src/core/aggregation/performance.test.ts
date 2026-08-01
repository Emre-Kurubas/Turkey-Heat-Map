import { describe, expect, it } from 'vitest';
import { generateMockData } from '@/data/mock/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { IL_BY_CODE } from '@/core/geo/index.js';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
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

/**
 * The axis that actually scales: the crime taxonomy.
 *
 * 973 districts and ten years are fixed by the geography and by what anyone
 * publishes. The number of offence types is not — a real taxonomy runs to
 * thousands — and it multiplies straight through both. These sizes were
 * measured rather than guessed; the numbers behind the thresholds are in the
 * README under "Ölçek sınırları".
 */
describe('aggregation performance as the taxonomy grows', () => {
  const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const DISTRICTS = [...getLevelRegionMeta('ilce').keys()];

  function dataset(categoryCount: number): {
    records: CrimeRecord[]; categories: CrimeCategory[];
  } {
    const categories = Array.from({ length: categoryCount }, (_, i) => ({
      id: `c${i}`, label: `Tür ${i}`,
    }));
    const records: CrimeRecord[] = [];
    for (const ilceCode of DISTRICTS) {
      for (const category of categories) {
        for (const year of YEARS) {
          records.push({
            year, ilCode: ilceCode.slice(0, 2), ilceCode, category: category.id, count: 3,
          });
        }
      }
    }
    return { records, categories };
  }

  // 64 categories over every district and year: ~623k records, an order of
  // magnitude past the shipped mock and a plausible real taxonomy.
  const big = dataset(64);

  it('builds a 600k-record index in under 3 s', () => {
    expect(big.records.length).toBeGreaterThan(600_000);
    const started = performance.now();
    buildIndex({ data: big.records, categories: big.categories });
    // Once, at mount. Loose because it is dominated by allocation, which is the
    // first thing a slow CI runner is bad at.
    expect(performance.now() - started).toBeLessThan(3_000);
  });

  it('rolls up 600k records in under 400 ms', () => {
    const index = buildIndex({ data: big.records, categories: big.categories });
    const started = performance.now();
    rollup(index, 'ilce', { yearRange: [2015, 2024], categories: [] });
    expect(performance.now() - started).toBeLessThan(400);
  });

  /**
   * The behaviour year bucketing exists for, and the one worth guarding.
   *
   * The year range is the most-dragged control on the page. Before the records
   * were grouped by year, every drag re-scanned the whole dataset and narrowing
   * the range cost exactly as much as widening it. Grouped, the work follows
   * the size of the selection — so this is a claim about the shape of the cost,
   * not about a machine.
   */
  it('makes a narrowed year range proportionally cheaper', () => {
    const index = buildIndex({ data: big.records, categories: big.categories });

    const measure = (range: [number, number]): number => {
      const started = performance.now();
      rollup(index, 'ilce', { yearRange: range, categories: [] });
      return performance.now() - started;
    };

    // Warm the paths so the first JIT pass is not attributed to one of them.
    measure([2015, 2024]);
    measure([2020, 2020]);

    const all = Math.max(measure([2015, 2024]), 1);
    const one = measure([2020, 2020]);

    // A tenth of the years should cost well under half of the whole range.
    // Deliberately not "a tenth": the fixed cost of building the result maps
    // does not shrink with the selection.
    expect(one).toBeLessThan(all * 0.5);
  });

  it('groups every record into its year, losing none', () => {
    // The bucketing is only sound if the buckets and the flat list agree.
    const index = buildIndex({ data: big.records, categories: big.categories });
    const bucketed = [...index.byYear.values()].reduce((n, bucket) => n + bucket.length, 0);
    expect(bucketed).toBe(index.records.length);
    expect([...index.byYear.keys()].sort((a, b) => a - b)).toEqual(index.years);
  });
});
