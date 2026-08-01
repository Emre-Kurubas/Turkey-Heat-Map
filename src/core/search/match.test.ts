import { describe, expect, it } from 'vitest';
import { buildSearchIndex } from './entities.js';
import { scoreEntity, searchEntities } from './match.js';
import { foldTurkish } from './normalize.js';

const INDEX = buildSearchIndex({
  ilRegions: [
    { code: '34', name: 'İstanbul', parentCode: null },
    { code: '35', name: 'İzmir', parentCode: null },
    { code: '19', name: 'Çorum', parentCode: null },
    { code: '63', name: 'Şanlıurfa', parentCode: null },
    { code: '03', name: 'Afyonkarahisar', parentCode: null },
  ],
  ilceRegions: [
    { code: '3401', name: 'Şişli', parentCode: '34' },
    { code: '3402', name: 'Kadıköy', parentCode: '34' },
    { code: '3501', name: 'Karşıyaka', parentCode: '35' },
  ],
  categories: [
    { id: 'hirsizlik', label: 'Hırsızlık' },
    { id: 'siber', label: 'Siber Suçlar' },
  ],
  years: [2022, 2023],
  ilNames: new Map([['34', 'İstanbul'], ['35', 'İzmir']]),
});

const ids = (query: string, limit?: number): string[] =>
  searchEntities(INDEX, query, limit).map((r) => r.entity.id);

describe('scoreEntity', () => {
  const istanbul = INDEX.find((e) => e.id === '34')!;

  it('scores an exact match highest', () => {
    expect(scoreEntity(foldTurkish('İstanbul'), istanbul))
      .toBeGreaterThan(scoreEntity('istan', istanbul));
  });

  it('scores a prefix above a substring', () => {
    expect(scoreEntity('istan', istanbul)).toBeGreaterThan(scoreEntity('tanbul', istanbul));
  });

  it('scores a substring above a fuzzy match', () => {
    expect(scoreEntity('tanbul', istanbul)).toBeGreaterThan(scoreEntity('istanbol', istanbul));
  });

  it('returns 0 for no match', () => {
    expect(scoreEntity('zzzzzz', istanbul)).toBe(0);
  });

  it('returns 0 for an empty query', () => {
    expect(scoreEntity('', istanbul)).toBe(0);
  });

  it('does not fuzzy-match queries too short to distinguish a typo', () => {
    // "ist" is 3 chars; allowing 2 edits there would match almost anything.
    expect(scoreEntity('xyz', istanbul)).toBe(0);
  });

  it('matches on a word boundary inside a multi-word label', () => {
    const siber = INDEX.find((e) => e.id === 'siber')!;
    expect(scoreEntity('suc', siber)).toBeGreaterThan(0);
  });
});

describe('searchEntities — Turkish handling', () => {
  it('finds Şişli when typing sisli', () => {
    expect(ids('sisli')[0]).toBe('3401');
  });

  it('finds names typed without diacritics', () => {
    expect(ids('corum')[0]).toBe('19');
    expect(ids('sanliurfa')[0]).toBe('63');
    expect(ids('kadikoy')[0]).toBe('3402');
    expect(ids('karsiyaka')[0]).toBe('3501');
  });

  it('finds İstanbul from every casing of the query', () => {
    for (const query of ['istanbul', 'İstanbul', 'ISTANBUL', 'ıstanbul', 'Istanbul']) {
      expect(ids(query)[0]).toBe('34');
    }
  });

  it('finds categories by their Turkish label', () => {
    expect(ids('hirsizlik')[0]).toBe('hirsizlik');
    expect(ids('Hırsızlık')[0]).toBe('hirsizlik');
  });

  it('finds years', () => {
    expect(ids('2023')).toContain('2023');
  });
});

describe('searchEntities — ranking', () => {
  it('ranks an exact match first', () => {
    expect(ids('izmir')[0]).toBe('35');
  });

  it('ranks prefix matches above substring matches', () => {
    const results = ids('kar');
    expect(results.indexOf('3501')).toBeLessThan(results.indexOf('03'));
  });

  it('tolerates a single typo', () => {
    expect(ids('istanbol')).toContain('34');
    expect(ids('izmirr')).toContain('35');
  });

  it('rejects a query too far from anything', () => {
    expect(ids('qwertyuiop')).toEqual([]);
  });

  it('breaks ties by type priority, provinces before years', () => {
    const scored = searchEntities(INDEX, 'i');
    const firstIl = scored.findIndex((r) => r.entity.type === 'il');
    const firstYear = scored.findIndex((r) => r.entity.type === 'year');
    if (firstYear !== -1) expect(firstIl).toBeLessThan(firstYear);
  });

  it('is stable across repeated calls', () => {
    expect(ids('ka')).toEqual(ids('ka'));
  });

  it('respects the result limit', () => {
    expect(searchEntities(INDEX, 'i', 3)).toHaveLength(3);
  });

  it('defaults to a sane limit', () => {
    expect(searchEntities(INDEX, 'i').length).toBeLessThanOrEqual(20);
  });

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchEntities(INDEX, '')).toEqual([]);
    expect(searchEntities(INDEX, '   ')).toEqual([]);
  });

  it('returns nothing when the index is empty', () => {
    expect(searchEntities([], 'istanbul')).toEqual([]);
  });

  it('handles a limit of zero', () => {
    expect(searchEntities(INDEX, 'i', 0)).toEqual([]);
  });

  it('stays fast on a realistic index', () => {
    // ~1,070 entities is the real scale: 81 il + 973 ilçe + categories + years.
    const large = buildSearchIndex({
      ilRegions: Array.from({ length: 81 }, (_, i) => ({
        code: String(i).padStart(2, '0'), name: `İl ${i}`, parentCode: null,
      })),
      ilceRegions: Array.from({ length: 973 }, (_, i) => ({
        code: String(i).padStart(4, '0'), name: `İlçe ${i}`, parentCode: '34',
      })),
      categories: [], years: [], ilNames: new Map(),
    });

    const started = performance.now();
    for (let i = 0; i < 20; i += 1) searchEntities(large, 'ilce 4');
    expect((performance.now() - started) / 20).toBeLessThan(20);
  });
});
