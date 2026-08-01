import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { reconcileProps } from './reconcile.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];
const DATA: CrimeRecord[] = [
  { year: 2018, ilCode: '34', category: 'hirsizlik', count: 10 },
  { year: 2022, ilCode: '06', category: 'darp', count: 20 },
];

const index = buildIndex({ data: DATA, categories: CATEGORIES });

describe('reconcileProps — year range', () => {
  it('clamps a range that overhangs the data span', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2000, 2100], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2022]);
  });

  it('falls back to the full span and warns when the range misses entirely', () => {
    const { filters, warnings } = reconcileProps(
      { defaultFilters: { yearRange: [1990, 1995], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2022]);
    expect(warnings.some((w) => w.includes('yıl'))).toBe(true);
  });

  it('keeps a valid range untouched', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2018], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2018]);
  });

  it('normalizes a reversed range rather than producing an empty selection', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2022, 2018], categories: [] } },
      index,
    );
    expect(filters.yearRange).toEqual([2018, 2022]);
  });

  it('defaults to the full span when no range is given', () => {
    expect(reconcileProps({}, index).filters.yearRange).toEqual([2018, 2022]);
  });
});

describe('reconcileProps — categories', () => {
  it('drops unknown categories and warns', () => {
    const { filters, warnings } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2022], categories: ['hirsizlik', 'yok'] } },
      index,
    );
    expect(filters.categories).toEqual(['hirsizlik']);
    expect(warnings.some((w) => w.includes('kategori'))).toBe(true);
  });

  it('keeps known categories', () => {
    const { filters } = reconcileProps(
      { defaultFilters: { yearRange: [2018, 2022], categories: ['darp'] } },
      index,
    );
    expect(filters.categories).toEqual(['darp']);
  });
});

describe('reconcileProps — metric', () => {
  it('falls back to total when perCapita is asked for without population', () => {
    const { metric, warnings } = reconcileProps({ metric: 'perCapita' }, index);
    expect(metric).toBe('total');
    expect(warnings.some((w) => w.includes('Nüfus'))).toBe(true);
  });

  it('honours perCapita when population is supplied', () => {
    const { metric } = reconcileProps(
      { metric: 'perCapita', population: [{ ilCode: '34', year: 2018, population: 1 }] },
      index,
    );
    expect(metric).toBe('perCapita');
  });

  it('falls back when population is supplied but empty', () => {
    expect(reconcileProps({ metric: 'perCapita', population: [] }, index).metric).toBe('total');
  });
});

describe('reconcileProps — level', () => {
  it('falls back to il when ilce is requested on an il-only dataset', () => {
    const { level, warnings } = reconcileProps(
      { defaultView: { level: 'ilce', focusedIl: null } },
      index,
    );
    expect(level).toBe('il');
    expect(warnings.some((w) => w.includes('ilçe'))).toBe(true);
  });

  it('honours ilce when the data has district codes', () => {
    const withIlce = buildIndex({
      data: [{ year: 2020, ilCode: '34', ilceCode: '3401', category: 'darp', count: 1 }],
      categories: CATEGORIES,
    });
    expect(reconcileProps({ defaultView: { level: 'ilce', focusedIl: null } }, withIlce).level)
      .toBe('ilce');
  });

  it('defaults to il', () => {
    expect(reconcileProps({}, index).level).toBe('il');
  });
});

describe('reconcileProps — empty data', () => {
  it('produces a usable filter set rather than NaN years', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    const { filters } = reconcileProps({}, empty);
    expect(Number.isFinite(filters.yearRange[0])).toBe(true);
    expect(filters.yearRange[0]).toBeLessThanOrEqual(filters.yearRange[1]);
  });
});
