import { describe, expect, it } from 'vitest';
import { parseHex, rgbToOklab } from './interpolate.js';
import {
  BLUE_RED_STOPS, DIFF_STOPS, SPECTRAL_STOPS,
  createColorScale, createDiffColorScale,
} from './scales.js';

function hue(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.atan2(lab.b, lab.a);
}
function chroma(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.hypot(lab.a, lab.b);
}

describe('stop definitions', () => {
  it('defines spectral from blue to red', () => {
    expect(SPECTRAL_STOPS.length).toBeGreaterThanOrEqual(5);
    expect(SPECTRAL_STOPS[0]).toMatch(/^#[\da-f]{6}$/u);
    expect(SPECTRAL_STOPS.at(-1)).toMatch(/^#[\da-f]{6}$/u);
  });

  it('gives every stop a valid hex value', () => {
    for (const stops of [SPECTRAL_STOPS, BLUE_RED_STOPS, DIFF_STOPS]) {
      for (const stop of stops) expect(parseHex(stop)).not.toBeNull();
    }
  });

  it('puts a near-neutral color at the center of the diverging diff ramp', () => {
    const middle = DIFF_STOPS[Math.floor(DIFF_STOPS.length / 2)]!;
    expect(chroma(middle)).toBeLessThan(0.05);
  });
});

describe('createColorScale', () => {
  const values = [0, 25, 50, 75, 100];

  it('maps the lowest value to the cool end and the highest to the warm end', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'spectral' });
    const low = scale(0);
    const high = scale(100);
    expect(low).toBe(SPECTRAL_STOPS[0]);
    expect(high).toBe(SPECTRAL_STOPS.at(-1));
    expect(hue(low)).not.toBeCloseTo(hue(high), 1);
  });

  it('exposes the underlying domain', () => {
    const scale = createColorScale({ values, mode: 'quantile', ramp: 'spectral' });
    expect(scale.domain.mode).toBe('quantile');
    expect(scale.domain.min).toBe(0);
    expect(scale.domain.max).toBe(100);
  });

  it('exposes the ramp function', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'blueRed' });
    expect(scale.ramp(0)).toBe(BLUE_RED_STOPS[0]);
  });

  it('accepts a custom ramp function', () => {
    const scale = createColorScale({
      values, mode: 'linear',
      ramp: (t) => (t < 0.5 ? '#000000' : '#ffffff'),
    });
    expect(scale(0)).toBe('#000000');
    expect(scale(100)).toBe('#ffffff');
  });

  it('produces distinct colors across a skewed distribution in quantile mode', () => {
    const skewed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 5000];
    const scale = createColorScale({ values: skewed, mode: 'quantile', ramp: 'spectral' });
    const colors = skewed.map((v) => scale(v));
    expect(new Set(colors).size).toBeGreaterThanOrEqual(9);
  });

  it('returns a stable mid color when every value is identical', () => {
    const scale = createColorScale({ values: [4, 4, 4], mode: 'linear', ramp: 'spectral' });
    expect(scale(4)).toBe(scale(4));
    expect(parseHex(scale(4))).not.toBeNull();
  });

  it('returns a valid color for an empty dataset', () => {
    const scale = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    expect(parseHex(scale(0))).not.toBeNull();
  });
});

describe('createDiffColorScale', () => {
  const scale = createDiffColorScale(100);

  it('is symmetric around zero', () => {
    expect(scale.domain.min).toBe(-100);
    expect(scale.domain.max).toBe(100);
  });

  it('renders zero as the near-neutral center color', () => {
    expect(chroma(scale(0))).toBeLessThan(0.05);
  });

  it('renders increases and decreases as opposite hues', () => {
    const increase = scale(100);
    const decrease = scale(-100);
    expect(Math.abs(hue(increase) - hue(decrease))).toBeGreaterThan(1);
  });

  it('clamps deltas beyond the stated maximum', () => {
    expect(scale(500)).toBe(scale(100));
    expect(scale(-500)).toBe(scale(-100));
  });

  it('treats a zero maximum as an all-neutral scale', () => {
    const flat = createDiffColorScale(0);
    expect(chroma(flat(0))).toBeLessThan(0.05);
    expect(flat(10)).toBe(flat(0));
  });

  it('uses the absolute value of a negative maximum', () => {
    const negative = createDiffColorScale(-100);
    expect(negative.domain.min).toBe(-100);
    expect(negative.domain.max).toBe(100);
  });
});
