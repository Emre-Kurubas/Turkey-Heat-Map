import { describe, expect, it } from 'vitest';
import { foldTurkish, toTurkishLowerCase, toTurkishUpperCase } from './normalize.js';

describe('foldTurkish', () => {
  it('folds every spelling of İstanbul to the same key', () => {
    const forms = ['İstanbul', 'istanbul', 'ISTANBUL', 'ıstanbul', 'Istanbul', 'İSTANBUL'];
    const folded = forms.map(foldTurkish);
    expect(new Set(folded).size).toBe(1);
    expect(folded[0]).toBe('istanbul');
  });

  it('folds Turkish-specific letters to ASCII', () => {
    expect(foldTurkish('Şişli')).toBe('sisli');
    expect(foldTurkish('Ağrı')).toBe('agri');
    expect(foldTurkish('Çorum')).toBe('corum');
    expect(foldTurkish('Gümüşhane')).toBe('gumushane');
    expect(foldTurkish('Kırşehir')).toBe('kirsehir');
    expect(foldTurkish('Diyarbakır')).toBe('diyarbakir');
    expect(foldTurkish('Şanlıurfa')).toBe('sanliurfa');
    expect(foldTurkish('Çanakkale')).toBe('canakkale');
    expect(foldTurkish('Nevşehir')).toBe('nevsehir');
    expect(foldTurkish('Muğla')).toBe('mugla');
  });

  it('folds circumflex vowels used in Turkish loanwords', () => {
    expect(foldTurkish('Kâzım')).toBe('kazim');
    expect(foldTurkish('Lâtif')).toBe('latif');
  });

  it('handles the combining-dot form produced by "İ".toLowerCase()', () => {
    // "İ".toLowerCase() is "i" + U+0307 in JS, which must not survive folding.
    const combining = 'İ'.toLowerCase() + 'stanbul';
    expect(foldTurkish(combining)).toBe('istanbul');
  });

  it('folds non-Turkish letters through the default lowercase path', () => {
    expect(foldTurkish('Wien')).toBe('wien');
    expect(foldTurkish('QUEBEC')).toBe('quebec');
  });

  it('strips diacritics from non-Turkish accented letters', () => {
    expect(foldTurkish('Zürich')).toBe('zurich');
    expect(foldTurkish('Málaga')).toBe('malaga');
  });

  it('is idempotent', () => {
    const once = foldTurkish('Şanlıurfa');
    expect(foldTurkish(once)).toBe(once);
  });

  it('preserves spaces, hyphens and digits', () => {
    expect(foldTurkish('Afyonkarahisar 2023')).toBe('afyonkarahisar 2023');
    expect(foldTurkish('Şişli-Mecidiyeköy')).toBe('sisli-mecidiyekoy');
  });

  it('returns an empty string for empty input', () => {
    expect(foldTurkish('')).toBe('');
  });
});

describe('toTurkishLowerCase', () => {
  it('maps dotted capital I to dotted lowercase i', () => {
    expect(toTurkishLowerCase('İSTANBUL')).toBe('istanbul');
  });

  it('maps dotless capital I to dotless lowercase ı', () => {
    expect(toTurkishLowerCase('IĞDIR')).toBe('ığdır');
  });

  it('leaves other Turkish letters intact', () => {
    expect(toTurkishLowerCase('ŞANLIURFA')).toBe('şanlıurfa');
    expect(toTurkishLowerCase('ÇORUM')).toBe('çorum');
  });
});

describe('toTurkishUpperCase', () => {
  it('maps dotted lowercase i to dotted capital İ', () => {
    expect(toTurkishUpperCase('istanbul')).toBe('İSTANBUL');
  });

  it('maps dotless lowercase ı to dotless capital I', () => {
    expect(toTurkishUpperCase('ığdır')).toBe('IĞDIR');
  });

  it('round-trips with toTurkishLowerCase', () => {
    for (const name of ['İstanbul', 'Iğdır', 'Şanlıurfa', 'Çorum', 'Muğla']) {
      expect(toTurkishLowerCase(toTurkishUpperCase(name))).toBe(toTurkishLowerCase(name));
    }
  });
});
