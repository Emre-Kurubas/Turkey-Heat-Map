import { describe, expect, it } from 'vitest';
import { foldTurkish } from '@/core/search/normalize.js';
import { IL_BY_CODE, IL_REGIONS, ilCodeFromIlceCode, isValidIlCode } from './region-meta.js';

describe('IL_REGIONS', () => {
  it('contains exactly 81 provinces', () => {
    expect(IL_REGIONS).toHaveLength(81);
  });

  it('uses zero-padded two-digit codes from 01 to 81 with no gaps', () => {
    const codes = IL_REGIONS.map((r) => r.code).sort();
    const expected = Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(2, '0')).sort();
    expect(codes).toEqual(expected);
  });

  it('has no duplicate codes or names', () => {
    expect(new Set(IL_REGIONS.map((r) => r.code)).size).toBe(81);
    expect(new Set(IL_REGIONS.map((r) => r.name)).size).toBe(81);
  });

  it('gives every il a null parentCode', () => {
    expect(IL_REGIONS.every((r) => r.parentCode === null)).toBe(true);
  });

  it('maps well-known plaka codes to the right provinces', () => {
    expect(IL_BY_CODE.get('01')?.name).toBe('Adana');
    expect(IL_BY_CODE.get('06')?.name).toBe('Ankara');
    expect(IL_BY_CODE.get('34')?.name).toBe('İstanbul');
    expect(IL_BY_CODE.get('35')?.name).toBe('İzmir');
    expect(IL_BY_CODE.get('81')?.name).toBe('Düzce');
  });

  it('spells province names with correct Turkish orthography', () => {
    // A name stored without its diacritics would fold to a different key and
    // silently break search. Spot-check the ones most often mis-typed.
    expect(IL_BY_CODE.get('34')?.name).toBe('İstanbul');
    expect(foldTurkish(IL_BY_CODE.get('34')!.name)).toBe('istanbul');
    expect(IL_BY_CODE.get('63')?.name).toBe('Şanlıurfa');
    expect(IL_BY_CODE.get('21')?.name).toBe('Diyarbakır');
    expect(IL_BY_CODE.get('76')?.name).toBe('Iğdır');
    expect(IL_BY_CODE.get('29')?.name).toBe('Gümüşhane');
  });
});

describe('isValidIlCode', () => {
  it('accepts real plaka codes', () => {
    expect(isValidIlCode('01')).toBe(true);
    expect(isValidIlCode('81')).toBe(true);
  });

  it('rejects out-of-range, unpadded and malformed codes', () => {
    expect(isValidIlCode('82')).toBe(false);
    expect(isValidIlCode('00')).toBe(false);
    expect(isValidIlCode('1')).toBe(false);
    expect(isValidIlCode('')).toBe(false);
    expect(isValidIlCode('ab')).toBe(false);
  });
});

describe('ilCodeFromIlceCode', () => {
  it('takes the first two digits as the parent province', () => {
    expect(ilCodeFromIlceCode('3401')).toBe('34');
    expect(ilCodeFromIlceCode('0612')).toBe('06');
  });

  it('returns null when the code is malformed or names no real province', () => {
    expect(ilCodeFromIlceCode('9901')).toBeNull();
    expect(ilCodeFromIlceCode('340')).toBeNull();
    expect(ilCodeFromIlceCode('34011')).toBeNull();
    expect(ilCodeFromIlceCode('')).toBeNull();
  });
});
