import { describe, expect, it } from 'vitest';
import { createPrng } from './prng.js';

describe('createPrng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPrng(42);
    const b = createPrng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, createPrng(1));
    const b = Array.from({ length: 20 }, createPrng(2));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const next = createPrng(7);
    for (let i = 0; i < 5000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads roughly uniformly across ten buckets', () => {
    const next = createPrng(99);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i += 1) {
      buckets[Math.floor(next() * 10)]! += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(8_000);
      expect(count).toBeLessThan(12_000);
    }
  });

  it('accepts a zero seed', () => {
    expect(() => createPrng(0)()).not.toThrow();
  });
});
