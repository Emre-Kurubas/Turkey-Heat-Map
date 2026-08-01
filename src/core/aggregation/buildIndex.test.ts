import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

function record(over: Partial<CrimeRecord> = {}): CrimeRecord {
  return { year: 2023, ilCode: '34', category: 'hirsizlik', count: 10, ...over };
}

describe('buildIndex — valid data', () => {
  it('normalizes a minimal il-level dataset', () => {
    const index = buildIndex({ data: [record()], categories: CATEGORIES });

    expect(index.records).toEqual([
      { year: 2023, ilCode: '34', ilceCode: null, category: 'hirsizlik', count: 10 },
    ]);
    expect(index.years).toEqual([2023]);
    expect(index.ilCodes).toEqual(['34']);
    expect(index.hasIlceData).toBe(false);
    expect(index.warnings).toEqual([]);
  });

  it('detects ilçe data and collects ilçe codes', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3402' })],
      categories: CATEGORIES,
    });

    expect(index.hasIlceData).toBe(true);
    expect(index.ilceCodes).toEqual(['3401', '3402']);
  });

  it('returns years ascending and deduplicated', () => {
    const index = buildIndex({
      data: [record({ year: 2023 }), record({ year: 2019 }), record({ year: 2023, count: 5 })],
      categories: CATEGORIES,
    });
    expect(index.years).toEqual([2019, 2023]);
  });

  it('preserves the supplied category order', () => {
    const index = buildIndex({ data: [record()], categories: CATEGORIES });
    expect(index.categories).toEqual(['hirsizlik', 'darp']);
  });

  it('sorts il and ilçe codes ascending regardless of input order', () => {
    const index = buildIndex({
      data: [
        record({ ilCode: '34', ilceCode: '3402' }),
        record({ ilCode: '06', ilceCode: '0601' }),
      ],
      categories: CATEGORIES,
    });
    expect(index.ilCodes).toEqual(['06', '34']);
    expect(index.ilceCodes).toEqual(['0601', '3402']);
  });

  it('accepts an ilçe code present in a supplied known-code set', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' })],
      categories: CATEGORIES,
      knownIlceCodes: new Set(['3401']),
    });
    expect(index.records).toHaveLength(1);
  });
});

describe('buildIndex — invalid data is dropped, never thrown', () => {
  it('drops records with an unknown il code', () => {
    const index = buildIndex({
      data: [record(), record({ ilCode: '99' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    const warning = index.warnings.find((w) => w.code === 'unknown-il');
    expect(warning?.count).toBe(1);
    expect(warning?.samples).toContain('99');
  });

  it('drops records whose ilçe code is structurally malformed', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '340' }), record({ ilceCode: 'abcd' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'unknown-ilce')?.count).toBe(2);
  });

  it('drops records whose ilçe code contradicts its il code', () => {
    // 3401 belongs to İstanbul (34), not Ankara (06). Silently trusting either
    // field would put crimes in the wrong province.
    const index = buildIndex({
      data: [record({ ilCode: '06', ilceCode: '3401' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'ilce-parent-mismatch')?.count).toBe(1);
  });

  it('drops ilçe codes absent from a supplied known-code set', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3499' })],
      categories: CATEGORIES,
      knownIlceCodes: new Set(['3401']),
    });

    expect(index.records).toHaveLength(1);
    expect(index.warnings.find((w) => w.code === 'unknown-ilce')?.samples).toContain('3499');
  });

  it('drops records with an unknown category', () => {
    const index = buildIndex({
      data: [record(), record({ category: 'yok' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    expect(index.warnings.find((w) => w.code === 'unknown-category')?.samples).toContain('yok');
  });

  it('drops negative, fractional and non-numeric counts', () => {
    const index = buildIndex({
      data: [
        record({ count: -5 }),
        record({ count: 1.5 }),
        record({ count: Number.NaN }),
        record({ count: Number.POSITIVE_INFINITY }),
      ],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'invalid-count')?.count).toBe(4);
  });

  it('keeps a zero count, which is meaningful data', () => {
    const index = buildIndex({ data: [record({ count: 0 })], categories: CATEGORIES });
    expect(index.records).toHaveLength(1);
    expect(index.warnings).toEqual([]);
  });

  it('drops records with a non-integer or out-of-range year', () => {
    const index = buildIndex({
      data: [record({ year: 20.5 }), record({ year: 1200 }), record({ year: 3000 })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'invalid-year')?.count).toBe(3);
  });

  it('sums duplicate keys and warns', () => {
    const index = buildIndex({
      data: [record({ count: 10 }), record({ count: 5 })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    expect(index.records[0]!.count).toBe(15);
    expect(index.warnings.find((w) => w.code === 'duplicate-key')?.count).toBe(1);
  });

  it('does not merge records that differ only by ilçe', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3402' })],
      categories: CATEGORIES,
    });
    expect(index.records).toHaveLength(2);
  });

  it('caps warning samples at five', () => {
    const data = Array.from({ length: 20 }, (_, i) =>
      record({ ilCode: '99', category: `bilinmeyen-${i}` }));
    const index = buildIndex({ data, categories: CATEGORIES });

    const warning = index.warnings.find((w) => w.code === 'unknown-il');
    expect(warning?.count).toBe(20);
    expect(warning?.samples).toHaveLength(5);
  });

  it('writes warning messages in Turkish', () => {
    const index = buildIndex({ data: [record({ ilCode: '99' })], categories: CATEGORIES });
    expect(index.warnings[0]!.message).toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
  });

  it('never throws on wholly malformed input', () => {
    expect(() => buildIndex({
      data: [record({ ilCode: '99', ilceCode: 'zz', category: 'x', count: -1, year: 0 })],
      categories: CATEGORIES,
    })).not.toThrow();
  });
});

describe('buildIndex — empty inputs', () => {
  it('warns about an empty dataset', () => {
    const index = buildIndex({ data: [], categories: CATEGORIES });

    expect(index.records).toEqual([]);
    expect(index.years).toEqual([]);
    expect(index.hasIlceData).toBe(false);
    expect(index.warnings.find((w) => w.code === 'empty-dataset')).toBeDefined();
  });

  it('warns when every record is dropped', () => {
    const index = buildIndex({ data: [record({ ilCode: '99' })], categories: CATEGORIES });
    expect(index.warnings.find((w) => w.code === 'empty-dataset')).toBeDefined();
  });

  it('drops everything when no categories are supplied', () => {
    const index = buildIndex({ data: [record()], categories: [] });
    expect(index.records).toEqual([]);
  });
});
