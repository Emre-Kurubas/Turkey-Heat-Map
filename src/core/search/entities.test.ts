import { describe, expect, it } from 'vitest';
import type { CrimeCategory, RegionMeta } from '@/core/types/index.js';
import { buildSearchIndex } from './entities.js';

const IL: RegionMeta[] = [
  { code: '34', name: 'İstanbul', parentCode: null },
  { code: '19', name: 'Çorum', parentCode: null },
];
const ILCE: RegionMeta[] = [
  { code: '3401', name: 'Şişli', parentCode: '34' },
  { code: '1901', name: 'Alaca', parentCode: '19' },
];
const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const IL_NAMES = new Map([['34', 'İstanbul'], ['19', 'Çorum']]);

const INDEX = buildSearchIndex({
  ilRegions: IL, ilceRegions: ILCE, categories: CATEGORIES,
  years: [2022, 2023], ilNames: IL_NAMES,
});

describe('buildSearchIndex', () => {
  it('indexes every entity type', () => {
    expect(INDEX).toHaveLength(2 + 2 + 1 + 2);
    expect(new Set(INDEX.map((e) => e.type)))
      .toEqual(new Set(['il', 'ilce', 'category', 'year']));
  });

  it('precomputes the folded form of every label', () => {
    expect(INDEX.find((e) => e.id === '34')?.folded).toBe('istanbul');
    expect(INDEX.find((e) => e.id === '3401')?.folded).toBe('sisli');
    expect(INDEX.find((e) => e.id === '19')?.folded).toBe('corum');
    expect(INDEX.find((e) => e.id === 'hirsizlik')?.folded).toBe('hirsizlik');
  });

  it('attaches the parent province name to each ilçe', () => {
    // The dropdown shows "Şişli · İstanbul"; two provinces can hold districts
    // with the same name, so the parent is what disambiguates them.
    expect(INDEX.find((e) => e.id === '3401')?.parentLabel).toBe('İstanbul');
  });

  it('gives il, category and year entities a null parent', () => {
    for (const id of ['34', 'hirsizlik', '2023']) {
      expect(INDEX.find((e) => e.id === id)?.parentLabel).toBeNull();
    }
  });

  it('indexes years as string ids and labels', () => {
    const year = INDEX.find((e) => e.type === 'year' && e.id === '2023');
    expect(year?.label).toBe('2023');
    expect(year?.folded).toBe('2023');
  });

  it('falls back to the parent code when the province name is unknown', () => {
    const orphan = buildSearchIndex({
      ilRegions: [], ilceRegions: [{ code: '9901', name: 'Bilinmeyen', parentCode: '99' }],
      categories: [], years: [], ilNames: new Map(),
    });
    expect(orphan[0]!.parentLabel).toBe('99');
  });

  it('handles an ilçe with no parent code', () => {
    const orphan = buildSearchIndex({
      ilRegions: [], ilceRegions: [{ code: '3401', name: 'Şişli', parentCode: null }],
      categories: [], years: [], ilNames: IL_NAMES,
    });
    expect(orphan[0]!.parentLabel).toBeNull();
  });

  it('returns an empty index for empty input', () => {
    expect(buildSearchIndex({
      ilRegions: [], ilceRegions: [], categories: [], years: [], ilNames: new Map(),
    })).toEqual([]);
  });

  it('is deterministic', () => {
    const input = {
      ilRegions: IL, ilceRegions: ILCE, categories: CATEGORIES,
      years: [2022, 2023], ilNames: IL_NAMES,
    };
    expect(buildSearchIndex(input)).toEqual(buildSearchIndex(input));
  });
});
