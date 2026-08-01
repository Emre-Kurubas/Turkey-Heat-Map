import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import { ilCodeFromIlceCode } from '@/data/geo/region-meta.js';
import { getLevelRegionMeta } from '@/data/geo/topology.js';
import { MOCK_CATEGORIES } from './categories.js';
import { generateMockData } from './generate.js';

describe('generateMockData', () => {
  it('is fully reproducible from a seed', () => {
    expect(generateMockData({ seed: 5 }).records)
      .toEqual(generateMockData({ seed: 5 }).records);
  });

  it('produces different data for a different seed', () => {
    expect(generateMockData({ seed: 1 }).records)
      .not.toEqual(generateMockData({ seed: 2 }).records);
  });

  it('covers all 81 provinces', () => {
    const { records } = generateMockData();
    expect(new Set(records.map((r) => r.ilCode)).size).toBe(81);
  });

  it('covers ten years by default', () => {
    const { records } = generateMockData();
    expect(new Set(records.map((r) => r.year)).size).toBe(10);
  });

  it('covers every category', () => {
    const { records, categories } = generateMockData();
    expect(new Set(records.map((r) => r.category)).size).toBe(categories.length);
    expect(categories).toEqual(MOCK_CATEGORIES);
  });

  it('generates ilçe codes whose parent is the province they sit in', () => {
    const { records } = generateMockData();
    for (const rec of records) {
      expect(rec.ilceCode).toBeDefined();
      expect(ilCodeFromIlceCode(rec.ilceCode!)).toBe(rec.ilCode);
    }
  });

  it('names every generated ilçe code', () => {
    const { records, ilceNames } = generateMockData();
    for (const rec of records) {
      expect(ilceNames.get(rec.ilceCode!)).toBeTruthy();
    }
  });

  it('emits only non-negative integer counts', () => {
    for (const rec of generateMockData().records) {
      expect(Number.isInteger(rec.count)).toBe(true);
      expect(rec.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('passes buildIndex validation with no warnings', () => {
    // The generator's whole purpose is to be valid input. If this fails, either
    // the generator or the validator has drifted.
    const { records, categories } = generateMockData();
    const index = buildIndex({ data: records, categories });
    expect(index.warnings).toEqual([]);
    expect(index.records).toHaveLength(records.length);
  });

  it('produces a right-skewed distribution, as real crime data is', () => {
    // İstanbul should dominate; this is what makes quantile scaling necessary.
    const { records } = generateMockData();
    const totals = new Map<string, number>();
    for (const rec of records) {
      totals.set(rec.ilCode, (totals.get(rec.ilCode) ?? 0) + rec.count);
    }
    const sorted = [...totals.values()].sort((a, b) => b - a);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(sorted[0]!).toBeGreaterThan(median * 5);
    expect(totals.get('34')!).toBe(sorted[0]);
  });

  it('respects an explicit year list', () => {
    const { records } = generateMockData({ years: [2020, 2021] });
    expect(new Set(records.map((r) => r.year))).toEqual(new Set([2020, 2021]));
  });

  it('omits ilçe codes when asked', () => {
    const { records } = generateMockData({ includeIlce: false });
    expect(records.every((r) => r.ilceCode === undefined)).toBe(true);
    expect(buildIndex({ data: records, categories: MOCK_CATEGORIES }).hasIlceData).toBe(false);
  });

  it('omits population when asked', () => {
    expect(generateMockData({ includePopulation: false }).population).toEqual([]);
  });

  it('generates one population row per province per year', () => {
    const { population } = generateMockData({ years: [2020, 2021] });
    expect(population).toHaveLength(81 * 2);
    expect(population.every((p) => p.population > 0)).toBe(true);
  });

  it('handles an empty year list without throwing', () => {
    const { records } = generateMockData({ years: [] });
    expect(records).toEqual([]);
  });
});

describe('generateMockData — agreement with the shipped geography', () => {
  it('emits only ilçe codes that exist in the bundled geography', () => {
    const { records } = generateMockData({ seed: 7 });
    const real = getLevelRegionMeta('ilce');

    const unknown = new Set(
      records
        .map((record) => record.ilceCode)
        .filter((code): code is string => code !== undefined)
        .filter((code) => !real.has(code)),
    );
    expect([...unknown]).toEqual([]);
  });

  it('covers every real district, so no region renders as no-data by accident', () => {
    const { records } = generateMockData({ seed: 7 });
    const covered = new Set(records.map((record) => record.ilceCode));
    for (const code of getLevelRegionMeta('ilce').keys()) {
      expect(covered.has(code), code).toBe(true);
    }
  });

  it('names districts from the geography rather than inventing labels', () => {
    const { ilceNames } = generateMockData({ seed: 7 });
    expect(ilceNames.get('3401')).toBe(getLevelRegionMeta('ilce').get('3401')?.name);
    expect(ilceNames.size).toBe(973);
  });

  it('stays reproducible from a seed', () => {
    expect(generateMockData({ seed: 99 }).records)
      .toEqual(generateMockData({ seed: 99 }).records);
  });
});

describe('district-level variation', () => {
  /**
   * The bug this guards: shares were redrawn per category per year, so over
   * 8 categories × 10 years they averaged to the mean and every district in a
   * province ended up with the same total. The map then painted each province
   * one flat colour and the district view showed nothing new.
   */
  it('spreads districts within a province across a wide range', () => {
    const { records } = generateMockData();
    const totals = new Map<string, number>();
    for (const rec of records) {
      if (rec.ilceCode === undefined) continue;
      totals.set(rec.ilceCode, (totals.get(rec.ilceCode) ?? 0) + rec.count);
    }

    // İstanbul: 39 districts, the largest division in the country.
    const istanbul = [...totals.entries()]
      .filter(([code]) => code.startsWith('34'))
      .map(([, total]) => total)
      .sort((a, b) => b - a);

    expect(istanbul.length).toBeGreaterThan(30);
    expect(istanbul[0]!).toBeGreaterThan(istanbul.at(-1)! * 3);
  });

  it('varies districts in every province, not just the big ones', () => {
    const { records } = generateMockData();
    const totals = new Map<string, Map<string, number>>();
    for (const rec of records) {
      if (rec.ilceCode === undefined) continue;
      const perIl = totals.get(rec.ilCode) ?? new Map<string, number>();
      perIl.set(rec.ilceCode, (perIl.get(rec.ilceCode) ?? 0) + rec.count);
      totals.set(rec.ilCode, perIl);
    }

    for (const [ilCode, perIl] of totals) {
      // A province with a single district has nothing to vary.
      if (perIl.size < 4) continue;
      const values = [...perIl.values()].sort((a, b) => b - a);
      expect(values[0]!, `il ${ilCode}`).toBeGreaterThan(values.at(-1)! * 1.5);
    }
  });

  it('gives categories distinct national shares rather than a flat eighth', () => {
    const { records } = generateMockData();
    const byCategory = new Map<string, number>();
    for (const rec of records) {
      byCategory.set(rec.category, (byCategory.get(rec.category) ?? 0) + rec.count);
    }
    const shares = [...byCategory.values()].sort((a, b) => b - a);
    expect(shares[0]!).toBeGreaterThan(shares.at(-1)! * 3);
  });
});
