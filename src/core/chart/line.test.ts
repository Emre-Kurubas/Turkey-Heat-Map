import { describe, expect, it } from 'vitest';
import { areaPath, linePath, niceMax } from './line.js';

const POINTS = [{ x: 0, y: 100 }, { x: 50, y: 60 }, { x: 100, y: 80 }];

describe('linePath', () => {
  it('moves to the first point then lines to the rest', () => {
    expect(linePath(POINTS)).toBe('M0,100 L50,60 L100,80');
  });

  it('returns an empty path for no points', () => {
    expect(linePath([])).toBe('');
  });

  it('draws a lone point as a zero-length move, not a stray line', () => {
    expect(linePath([{ x: 5, y: 5 }])).toBe('M5,5');
  });
});

describe('areaPath', () => {
  it('closes the line down to the baseline', () => {
    const d = areaPath(POINTS, 200);
    expect(d.startsWith('M0,100')).toBe(true);
    expect(d).toContain('L100,200');
    expect(d).toContain('L0,200');
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('returns an empty path for no points', () => {
    expect(areaPath([], 200)).toBe('');
  });

  it('still closes for a single point', () => {
    const d = areaPath([{ x: 10, y: 40 }], 100);
    expect(d).toContain('L10,100');
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });
});

describe('niceMax', () => {
  it('rounds up to a readable axis top', () => {
    expect(niceMax(87)).toBe(100);
    expect(niceMax(1234)).toBe(2000);
    expect(niceMax(2100)).toBe(2500);
  });

  it('leaves an already-round value alone', () => {
    expect(niceMax(100)).toBe(100);
    expect(niceMax(500)).toBe(500);
  });

  it('returns a usable axis for zero, so an empty chart still has a scale', () => {
    expect(niceMax(0)).toBe(1);
  });

  it('handles a negative or non-finite value without producing NaN', () => {
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
    expect(niceMax(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
