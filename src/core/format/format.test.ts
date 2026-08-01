import { describe, expect, it } from 'vitest';
import {
  formatCompactTr, formatDelta, formatPercent, formatPercentDelta,
  formatTrDecimal, formatTrNumber,
} from './index.js';

describe('formatTrNumber', () => {
  it('groups thousands with periods', () => {
    expect(formatTrNumber(0)).toBe('0');
    expect(formatTrNumber(7)).toBe('7');
    expect(formatTrNumber(999)).toBe('999');
    expect(formatTrNumber(1000)).toBe('1.000');
    expect(formatTrNumber(12345)).toBe('12.345');
    expect(formatTrNumber(1234567)).toBe('1.234.567');
    expect(formatTrNumber(1000000000)).toBe('1.000.000.000');
  });

  it('handles negatives with a typographic minus', () => {
    expect(formatTrNumber(-1234)).toBe('−1.234');
  });

  it('rounds non-integers', () => {
    expect(formatTrNumber(1234.6)).toBe('1.235');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatTrNumber(Number.NaN)).toBe('—');
    expect(formatTrNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatTrNumber(Number.NEGATIVE_INFINITY)).toBe('—');
  });
});

describe('formatTrDecimal', () => {
  it('uses a comma as the decimal separator', () => {
    expect(formatTrDecimal(1.25, 1)).toBe('1,3');
    expect(formatTrDecimal(3.14159, 2)).toBe('3,14');
    expect(formatTrDecimal(1234.5, 1)).toBe('1.234,5');
  });

  it('pads to the requested digit count', () => {
    expect(formatTrDecimal(2, 2)).toBe('2,00');
  });

  it('omits the separator when digits is 0', () => {
    expect(formatTrDecimal(2.7, 0)).toBe('3');
  });

  it('handles negatives', () => {
    expect(formatTrDecimal(-1234.5, 1)).toBe('−1.234,5');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatTrDecimal(Number.NaN, 2)).toBe('—');
  });
});

describe('formatCompactTr', () => {
  it('leaves values below 1000 alone', () => {
    expect(formatCompactTr(0)).toBe('0');
    expect(formatCompactTr(999)).toBe('999');
  });

  it('abbreviates thousands as "B" (bin)', () => {
    expect(formatCompactTr(1000)).toBe('1,0 B');
    expect(formatCompactTr(12500)).toBe('12,5 B');
  });

  it('abbreviates millions as "Mn" and billions as "Mr"', () => {
    expect(formatCompactTr(1234567)).toBe('1,2 Mn');
    expect(formatCompactTr(2500000000)).toBe('2,5 Mr');
  });

  it('abbreviates negatives symmetrically', () => {
    expect(formatCompactTr(-12500)).toBe('−12,5 B');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatCompactTr(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('puts the percent sign first, as Turkish does', () => {
    expect(formatPercent(0.1234)).toBe('%12,3');
    expect(formatPercent(1)).toBe('%100,0');
    expect(formatPercent(0)).toBe('%0,0');
  });

  it('respects the digit count', () => {
    expect(formatPercent(0.1234, 2)).toBe('%12,34');
    expect(formatPercent(0.1234, 0)).toBe('%12');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('prefixes positives with a plus and negatives with a typographic minus', () => {
    expect(formatDelta(45)).toBe('+45');
    expect(formatDelta(-45)).toBe('−45');
    expect(formatDelta(1234)).toBe('+1.234');
  });

  it('renders zero without a sign', () => {
    expect(formatDelta(0)).toBe('0');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatDelta(Number.NaN)).toBe('—');
  });
});

describe('formatPercentDelta', () => {
  it('renders a signed percentage', () => {
    expect(formatPercentDelta(0.15)).toBe('+%15,0');
    expect(formatPercentDelta(-0.075)).toBe('−%7,5');
    expect(formatPercentDelta(0)).toBe('%0,0');
  });

  it('renders an em dash when the change is undefined', () => {
    // Undefined happens when the baseline is zero: growth from nothing has no ratio.
    expect(formatPercentDelta(null)).toBe('—');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatPercentDelta(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
