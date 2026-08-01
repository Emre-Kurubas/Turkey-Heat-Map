import { describe, expect, it } from 'vitest';
import { createColorDomain } from './domain.js';

describe('createColorDomain — linear', () => {
  const domain = createColorDomain([0, 50, 100], 'linear');

  it('maps min to 0 and max to 1', () => {
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(100)).toBe(1);
  });

  it('maps the midpoint to 0.5', () => {
    expect(domain.toT(50)).toBeCloseTo(0.5, 6);
  });

  it('clamps values outside the observed range', () => {
    expect(domain.toT(-10)).toBe(0);
    expect(domain.toT(1000)).toBe(1);
  });

  it('exposes the observed min and max', () => {
    expect(domain.min).toBe(0);
    expect(domain.max).toBe(100);
    expect(domain.mode).toBe('linear');
  });
});

describe('createColorDomain — log', () => {
  const domain = createColorDomain([0, 10, 100, 10000], 'log');

  it('maps min to 0 and max to 1', () => {
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(10000)).toBe(1);
  });

  it('lifts small values well above their linear position', () => {
    // 100 of 10000 is t=0.01 linearly; log should place it far higher.
    expect(domain.toT(100)).toBeGreaterThan(0.4);
  });

  it('increases monotonically', () => {
    const ts = [0, 10, 100, 1000, 10000].map((v) => domain.toT(v));
    for (let i = 1; i < ts.length; i += 1) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('clamps values outside the observed range', () => {
    expect(domain.toT(-500)).toBe(0);
    expect(domain.toT(999999)).toBe(1);
  });
});

describe('createColorDomain — quantile', () => {
  it('spreads a skewed distribution across the full range', () => {
    // One huge outlier and many small values: linear would flatten the small
    // ones to near-zero; quantile must separate them.
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    const domain = createColorDomain(values, 'quantile');

    const linear = createColorDomain(values, 'linear');
    expect(linear.toT(5)).toBeLessThan(0.01);
    expect(domain.toT(5)).toBeGreaterThan(0.3);
  });

  it('maps the smallest value to 0 and the largest to 1', () => {
    const domain = createColorDomain([5, 10, 20, 40], 'quantile');
    expect(domain.toT(5)).toBe(0);
    expect(domain.toT(40)).toBe(1);
  });

  it('increases monotonically across the sorted values', () => {
    const domain = createColorDomain([3, 1, 4, 1, 5, 9, 2, 6], 'quantile');
    const ts = [1, 2, 3, 4, 5, 6, 9].map((v) => domain.toT(v));
    for (let i = 1; i < ts.length; i += 1) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('deduplicates ties so repeated values share one position', () => {
    const domain = createColorDomain([1, 1, 1, 1, 100], 'quantile');
    expect(domain.sorted).toEqual([1, 100]);
    expect(domain.toT(1)).toBe(0);
    expect(domain.toT(100)).toBe(1);
  });

  it('interpolates values falling between observed values', () => {
    const domain = createColorDomain([0, 10, 20, 30, 40], 'quantile');
    const t = domain.toT(15);
    expect(t).toBeGreaterThan(domain.toT(10));
    expect(t).toBeLessThan(domain.toT(20));
  });

  it('clamps outside the observed range', () => {
    const domain = createColorDomain([10, 20], 'quantile');
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(99)).toBe(1);
  });

  it('returns a mid-position for a non-finite lookup', () => {
    expect(createColorDomain([1, 10], 'quantile').toT(Number.NaN)).toBe(0.5);
  });
});

describe('createColorDomain — degenerate inputs', () => {
  it('returns a mid-position for every value when all values are equal', () => {
    // With no spread there is no meaningful ranking, so a neutral mid-tone is
    // the honest rendering. Returning 0 would falsely imply "lowest".
    for (const mode of ['linear', 'log', 'quantile'] as const) {
      const domain = createColorDomain([7, 7, 7], mode);
      expect(domain.toT(7)).toBe(0.5);
      expect(domain.toT(0)).toBe(0.5);
      expect(domain.min).toBe(7);
      expect(domain.max).toBe(7);
    }
  });

  it('handles a single value', () => {
    const domain = createColorDomain([42], 'quantile');
    expect(domain.toT(42)).toBe(0.5);
  });

  it('handles an empty value list without throwing', () => {
    for (const mode of ['linear', 'log', 'quantile'] as const) {
      const domain = createColorDomain([], mode);
      expect(domain.min).toBe(0);
      expect(domain.max).toBe(0);
      expect(domain.toT(5)).toBe(0.5);
      expect(domain.sorted).toEqual([]);
    }
  });

  it('ignores non-finite values', () => {
    const domain = createColorDomain([1, Number.NaN, 10, Number.POSITIVE_INFINITY], 'linear');
    expect(domain.min).toBe(1);
    expect(domain.max).toBe(10);
  });

  it('returns a mid-position for a non-finite lookup', () => {
    expect(createColorDomain([1, 10], 'linear').toT(Number.NaN)).toBe(0.5);
    expect(createColorDomain([1, 10], 'log').toT(Number.NaN)).toBe(0.5);
  });

  it('shifts negative values into the log domain rather than failing', () => {
    const domain = createColorDomain([-50, 0, 50], 'log');
    expect(domain.toT(-50)).toBe(0);
    expect(domain.toT(50)).toBe(1);
  });
});
