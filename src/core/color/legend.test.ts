import { describe, expect, it } from 'vitest';
import { computeLegendBreaks } from './legend.js';
import { createColorScale } from './scales.js';

describe('computeLegendBreaks', () => {
  const scale = createColorScale({
    values: [0, 100, 200, 300, 400, 500],
    mode: 'linear',
    ramp: 'spectral',
  });

  it('returns the requested number of buckets', () => {
    expect(computeLegendBreaks(scale, 5)).toHaveLength(5);
    expect(computeLegendBreaks(scale, 3)).toHaveLength(3);
  });

  it('spans the whole domain with no gaps between buckets', () => {
    const breaks = computeLegendBreaks(scale, 5);
    expect(breaks[0]!.from).toBe(scale.domain.min);
    expect(breaks.at(-1)!.to).toBe(scale.domain.max);
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]!.from).toBe(breaks[i - 1]!.to);
    }
  });

  it('orders buckets from lowest to highest', () => {
    const breaks = computeLegendBreaks(scale, 5);
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]!.from).toBeGreaterThan(breaks[i - 1]!.from);
    }
  });

  it('gives each bucket the color of its own midpoint', () => {
    const breaks = computeLegendBreaks(scale, 5);
    for (const bucket of breaks) {
      expect(bucket.color).toBe(scale((bucket.from + bucket.to) / 2));
    }
  });

  it('formats labels in Turkish with an en dash', () => {
    const breaks = computeLegendBreaks(scale, 5);
    expect(breaks[0]!.label).toMatch(/^0\s–\s/u);
    expect(breaks.at(-1)!.label).toContain('500');
  });

  it('follows the quantile domain rather than even value steps', () => {
    // With a heavy outlier, quantile buckets must not be evenly spaced in value.
    const skewed = createColorScale({
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 5000],
      mode: 'quantile',
      ramp: 'spectral',
    });
    const breaks = computeLegendBreaks(skewed, 5);
    const widths = breaks.map((b) => b.to - b.from);
    const first = widths[0]!;
    expect(widths.some((w) => Math.abs(w - first) > 1)).toBe(true);
  });

  it('produces a single neutral bucket when every value is identical', () => {
    const flat = createColorScale({ values: [7, 7, 7], mode: 'linear', ramp: 'spectral' });
    const breaks = computeLegendBreaks(flat, 5);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]!.from).toBe(7);
    expect(breaks[0]!.to).toBe(7);
    expect(breaks[0]!.label).toBe('7');
  });

  it('produces a single bucket for an empty dataset', () => {
    const empty = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    expect(computeLegendBreaks(empty, 5)).toHaveLength(1);
  });

  it('clamps a nonsensical bucket count into range', () => {
    expect(computeLegendBreaks(scale, 0)).toHaveLength(1);
    expect(computeLegendBreaks(scale, -3)).toHaveLength(1);
    expect(computeLegendBreaks(scale, Number.NaN)).toHaveLength(1);
    expect(computeLegendBreaks(scale, 99).length).toBeLessThanOrEqual(12);
  });

});
