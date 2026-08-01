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

/** WCAG relative luminance, for asserting the ramp's lightness profile. */
function luminance(hex: string): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The light map surface these ramps are drawn on. */
const MAP_BG = '#eef1f6';

describe('SPECTRAL_STOPS on a light canvas', () => {
  it('gets strictly darker as values rise', () => {
    // Magnitude must read by lightness, not hue alone. The old dark-theme ramp
    // was light in the middle, and on a light canvas its mid-range vanished.
    const lums = SPECTRAL_STOPS.map(luminance);
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]!, `step ${i}`).toBeLessThan(lums[i - 1]!);
    }
  });

  it('separates every adjacent step by lightness alone', () => {
    for (let i = 1; i < SPECTRAL_STOPS.length; i += 1) {
      expect(contrast(SPECTRAL_STOPS[i - 1]!, SPECTRAL_STOPS[i]!), `pair ${i}`)
        .toBeGreaterThan(1.2);
    }
  });

  it('makes the high end unmistakable against the surface', () => {
    const top = SPECTRAL_STOPS[SPECTRAL_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(6);
  });

  it('lets the lowest step recede toward the surface, as near-zero should', () => {
    expect(contrast(SPECTRAL_STOPS[0]!, MAP_BG)).toBeLessThan(1.5);
  });

  it('is all six-digit hex', () => {
    for (const stop of SPECTRAL_STOPS) expect(stop).toMatch(/^#[0-9a-f]{6}$/u);
  });
});

describe('BLUE_RED_STOPS on a light canvas', () => {
  it('keeps its high end visible', () => {
    const top = BLUE_RED_STOPS[BLUE_RED_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(5);
  });

  it('has no step that disappears into the surface at the top half', () => {
    // The neutral middle may recede; the upper arm must not.
    for (const stop of BLUE_RED_STOPS.slice(4)) {
      expect(contrast(stop, MAP_BG), stop).toBeGreaterThan(1.6);
    }
  });
});
