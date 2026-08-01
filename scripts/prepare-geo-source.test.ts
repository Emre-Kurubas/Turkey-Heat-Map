import { describe, expect, it } from 'vitest';
import { normalizeDistrictName } from './prepare-geo-source.js';

describe('normalizeDistrictName — central districts', () => {
  it.each([
    ['Adıyaman merkez', 'Adıyaman'],
    ['Artvin Merkez', 'Artvin'],
    ['Bilecik (merkez)', 'Bilecik'],
    ['Afyonkarahisar (Merkez İlçe)', 'Afyonkarahisar'],
    ['Rize merkezi', 'Rize'],
    ['Giresun District', 'Giresun'],
  ])('collapses %s to Merkez', (name, il) => {
    expect(normalizeDistrictName(name, il)).toBe('Merkez');
  });

  it('matches across a missing circumflex, so Hakkari resolves against Hakkâri', () => {
    expect(normalizeDistrictName('Hakkari merkez', 'Hakkâri')).toBe('Merkez');
  });

  it('treats a district sharing its province name as that province centre', () => {
    expect(normalizeDistrictName('Ardahan', 'Ardahan')).toBe('Merkez');
  });

  it('leaves an already-correct Merkez alone', () => {
    expect(normalizeDistrictName('Merkez', 'Karabük')).toBe('Merkez');
  });
});

describe('normalizeDistrictName — names that must survive', () => {
  /**
   * `Merkezefendi` begins with the word "merkez" but is a real Denizli district.
   * Matching on the province name rather than the word is what protects it.
   */
  it('keeps Merkezefendi, which only looks like a centre', () => {
    expect(normalizeDistrictName('Merkezefendi', 'Denizli')).toBe('Merkezefendi');
  });

  it('keeps Gediz, which is a district of Kütahya and not its centre', () => {
    expect(normalizeDistrictName('Gediz Merkez', 'Kütahya')).toBe('Gediz');
  });

  it('renames the English Prince Islands to Adalar', () => {
    expect(normalizeDistrictName('Prince Islands', 'İstanbul')).toBe('Adalar');
  });

  it('passes ordinary district names through untouched', () => {
    expect(normalizeDistrictName('Şebinkarahisar', 'Giresun')).toBe('Şebinkarahisar');
    expect(normalizeDistrictName('19 Mayıs', 'Samsun')).toBe('19 Mayıs');
    expect(normalizeDistrictName('Şarkîkaraağaç', 'Isparta')).toBe('Şarkîkaraağaç');
  });

  it('does not collapse a district that merely starts with the province name', () => {
    expect(normalizeDistrictName('Ankara Yenimahalle', 'Ankara')).toBe('Ankara Yenimahalle');
  });
});
