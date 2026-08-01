import { describe, expect, it } from 'vitest';
import { compareTurkish } from './collate.js';

describe('compareTurkish', () => {
  it('orders the Turkish alphabet correctly', () => {
    const alphabet = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i',
      'j', 'k', 'l', 'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z'];
    const shuffled = [...alphabet].reverse();
    expect(shuffled.sort(compareTurkish)).toEqual(alphabet);
  });

  it('places ç after c, not after z', () => {
    expect(compareTurkish('Çorum', 'Denizli')).toBeLessThan(0);
    expect(compareTurkish('Çorum', 'Bursa')).toBeGreaterThan(0);
  });

  it('places ı before i', () => {
    expect(compareTurkish('Iğdır', 'İstanbul')).toBeLessThan(0);
  });

  it('places ş after s and ö after o', () => {
    expect(compareTurkish('Şanlıurfa', 'Tekirdağ')).toBeLessThan(0);
    expect(compareTurkish('Şanlıurfa', 'Sivas')).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(compareTurkish('ankara', 'ANKARA')).toBe(0);
  });

  it('sorts a realistic province list the way a Turkish reader expects', () => {
    const provinces = ['Zonguldak', 'Çorum', 'İstanbul', 'Iğdır', 'Şanlıurfa', 'Adana', 'Ordu'];
    expect([...provinces].sort(compareTurkish))
      .toEqual(['Adana', 'Çorum', 'Iğdır', 'İstanbul', 'Ordu', 'Şanlıurfa', 'Zonguldak']);
  });

  it('breaks prefix ties by length', () => {
    expect(compareTurkish('Kars', 'Karsantı')).toBeLessThan(0);
    expect(compareTurkish('Kars', 'Kars')).toBe(0);
  });

  it('sorts unknown characters after known ones, deterministically', () => {
    expect(compareTurkish('Wien', 'Zonguldak')).toBeGreaterThan(0);
    expect(compareTurkish('Wien', 'Wien')).toBe(0);
  });

  it('handles empty strings', () => {
    expect(compareTurkish('', '')).toBe(0);
    expect(compareTurkish('', 'a')).toBeLessThan(0);
  });
});
