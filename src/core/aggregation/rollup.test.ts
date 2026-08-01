import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2022, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2022, ilCode: '34', ilceCode: '3401', category: 'darp', count: 40 },
  { year: 2022, ilCode: '34', ilceCode: '3402', category: 'hirsizlik', count: 60 },
  { year: 2023, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 200 },
  { year: 2023, ilCode: '06', ilceCode: '0601', category: 'darp', count: 30 },
];

const INDEX = buildIndex({ data: DATA, categories: CATEGORIES });
const ALL: FilterSet = { yearRange: [2022, 2023], categories: [] };

describe('rollup — il level', () => {
  it('sums ilçe records up into their parent province', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect(result.byRegion.get('34')?.total).toBe(400);
    expect(result.byRegion.get('06')?.total).toBe(30);
  });

  it('reports the national total', () => {
    expect(rollup(INDEX, 'il', ALL).total).toBe(430);
  });

  it('breaks each region down by category and by year', () => {
    const istanbul = rollup(INDEX, 'il', ALL).byRegion.get('34')!;
    expect(istanbul.byCategory.get('hirsizlik')).toBe(360);
    expect(istanbul.byCategory.get('darp')).toBe(40);
    expect(istanbul.byYear.get(2022)).toBe(200);
    expect(istanbul.byYear.get(2023)).toBe(200);
  });

  it('reports national breakdowns for the charts', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect(result.byCategory.get('hirsizlik')).toBe(360);
    expect(result.byCategory.get('darp')).toBe(70);
    expect(result.byYear.get(2022)).toBe(200);
    expect(result.byYear.get(2023)).toBe(230);
  });

  it('exposes region totals for building a color domain', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect([...result.values].sort((a, b) => a - b)).toEqual([30, 400]);
  });
});

describe('rollup — ilçe level', () => {
  it('keys regions by ilçe code', () => {
    const result = rollup(INDEX, 'ilce', ALL);
    expect(result.byRegion.get('3401')?.total).toBe(340);
    expect(result.byRegion.get('3402')?.total).toBe(60);
    expect(result.byRegion.get('0601')?.total).toBe(30);
  });

  it('ignores records with no ilçe code', () => {
    const index = buildIndex({
      data: [
        { year: 2022, ilCode: '34', category: 'darp', count: 999 },
        { year: 2022, ilCode: '34', ilceCode: '3401', category: 'darp', count: 5 },
      ],
      categories: CATEGORIES,
    });
    const result = rollup(index, 'ilce', ALL);
    expect(result.total).toBe(5);
    expect(result.byRegion.size).toBe(1);
  });
});

describe('rollup — filtering', () => {
  it('restricts to the year range, inclusive at both ends', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2023], categories: [] });
    expect(result.total).toBe(230);
    expect(result.byRegion.get('34')?.total).toBe(200);
  });

  it('treats an empty category list as all categories', () => {
    const all = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: [] });
    const explicit = rollup(INDEX, 'il', {
      yearRange: [2022, 2023], categories: ['hirsizlik', 'darp'],
    });
    expect(all.total).toBe(explicit.total);
  });

  it('restricts to the selected categories', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: ['darp'] });
    expect(result.total).toBe(70);
    expect(result.byRegion.get('34')?.total).toBe(40);
  });

  it('omits regions with no matching records rather than listing them as zero', () => {
    // A region absent from the result is "no data"; a region present with 0 is
    // "measured zero". Conflating them would color unmeasured regions as safest.
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2023], categories: ['hirsizlik'] });
    expect(result.byRegion.has('06')).toBe(false);
    expect(result.byRegion.has('34')).toBe(true);
  });

  it('returns an empty result when the range matches nothing', () => {
    const result = rollup(INDEX, 'il', { yearRange: [1990, 1995], categories: [] });
    expect(result.total).toBe(0);
    expect(result.byRegion.size).toBe(0);
    expect(result.values).toEqual([]);
  });

  it('returns an empty result for an inverted year range', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2022], categories: [] });
    expect(result.total).toBe(0);
  });

  it('returns an empty result for an unknown category filter', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: ['yok'] });
    expect(result.total).toBe(0);
  });

  it('handles an empty index', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    const result = rollup(empty, 'il', ALL);
    expect(result.total).toBe(0);
    expect(result.byRegion.size).toBe(0);
  });

  it('reports the level it was asked for', () => {
    expect(rollup(INDEX, 'ilce', ALL).level).toBe('ilce');
  });
});
