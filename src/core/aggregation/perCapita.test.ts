import { describe, expect, it } from 'vitest';
import type { CrimeCategory, RegionPopulation } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { rollup } from './rollup.js';
import { buildPopulationIndex, toPerCapita } from './perCapita.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'a', label: 'A' }];
const index = buildIndex({
  data: [
    { year: 2020, ilCode: '34', category: 'a', count: 200 },
    { year: 2020, ilCode: '06', category: 'a', count: 50 },
  ],
  categories: CATEGORIES,
});
const rolled = rollup(index, 'il', { yearRange: [2020, 2020], categories: [] });

const POPULATION: RegionPopulation[] = [
  { ilCode: '34', year: 2020, population: 1_000_000 },
  { ilCode: '06', year: 2020, population: 500_000 },
];

describe('buildPopulationIndex', () => {
  it('keys provinces by plaka code', () => {
    expect(buildPopulationIndex(POPULATION, 'il', [2020, 2020]).get('34')).toBe(1_000_000);
  });

  it('averages across the filtered years rather than summing them', () => {
    // Summing would make a ten-year range look ten times as populous.
    const multi: RegionPopulation[] = [
      { ilCode: '34', year: 2020, population: 1_000_000 },
      { ilCode: '34', year: 2021, population: 1_200_000 },
    ];
    expect(buildPopulationIndex(multi, 'il', [2020, 2021]).get('34')).toBe(1_100_000);
  });

  it('ignores years outside the range', () => {
    const multi: RegionPopulation[] = [
      { ilCode: '34', year: 2019, population: 9_000_000 },
      { ilCode: '34', year: 2020, population: 1_000_000 },
    ];
    expect(buildPopulationIndex(multi, 'il', [2020, 2020]).get('34')).toBe(1_000_000);
  });

  it('keys districts by ilçe code at district level', () => {
    const district: RegionPopulation[] = [
      { ilCode: '34', ilceCode: '3401', year: 2020, population: 20_000 },
    ];
    expect(buildPopulationIndex(district, 'ilce', [2020, 2020]).get('3401')).toBe(20_000);
  });

  it('skips il-only rows at district level rather than mis-keying them', () => {
    expect(buildPopulationIndex(POPULATION, 'ilce', [2020, 2020]).size).toBe(0);
  });

  it('is empty for no population data', () => {
    expect(buildPopulationIndex([], 'il', [2020, 2020]).size).toBe(0);
  });
});

describe('toPerCapita', () => {
  const pop = buildPopulationIndex(POPULATION, 'il', [2020, 2020]);

  it('converts totals to a rate per 100,000', () => {
    const rate = toPerCapita(rolled, pop);
    expect(rate.byRegion.get('34')?.total).toBe(20);
    expect(rate.byRegion.get('06')?.total).toBe(10);
  });

  it('converts the per-category breakdown too', () => {
    expect(toPerCapita(rolled, pop).byRegion.get('34')?.byCategory.get('a')).toBe(20);
  });

  it('converts the per-year breakdown too', () => {
    expect(toPerCapita(rolled, pop).byRegion.get('34')?.byYear.get(2020)).toBe(20);
  });

  it('drops a region with no population rather than dividing by zero', () => {
    const rate = toPerCapita(rolled, new Map([['34', 1_000_000]]));
    expect(rate.byRegion.has('34')).toBe(true);
    expect(rate.byRegion.has('06')).toBe(false);
  });

  it('drops a region whose population is zero', () => {
    expect(toPerCapita(rolled, new Map([['34', 0]])).byRegion.has('34')).toBe(false);
  });

  it('rebuilds values so the colour domain follows the rate', () => {
    expect([...toPerCapita(rolled, pop).values].sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it('honours a custom per-N base', () => {
    expect(toPerCapita(rolled, pop, 1_000_000).byRegion.get('34')?.total).toBe(200);
  });

  it('keeps the level', () => {
    expect(toPerCapita(rolled, pop).level).toBe('il');
  });
});
