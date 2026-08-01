import { describe, expect, it } from 'vitest';
import { parseHex, rgbToOklab } from './interpolate.js';
import {
  DEEP_BLUE_STOPS, DIFF_STOPS, EMBER_STOPS,
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
  it('defines the default ramp with enough steps to read as a gradient', () => {
    expect(EMBER_STOPS.length).toBeGreaterThanOrEqual(5);
    expect(EMBER_STOPS[0]).toMatch(/^#[\da-f]{6}$/u);
    expect(EMBER_STOPS.at(-1)).toMatch(/^#[\da-f]{6}$/u);
  });

  it('gives every stop a valid hex value', () => {
    for (const stops of [EMBER_STOPS, DEEP_BLUE_STOPS, DIFF_STOPS]) {
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

  it('maps the lowest value to the pale end and the highest to the dark end', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'ember' });
    const low = scale(0);
    const high = scale(100);
    expect(low).toBe(EMBER_STOPS[0]);
    expect(high).toBe(EMBER_STOPS.at(-1));
    // The ends differ by lightness, not by hue — that is the point of a
    // single-hue ramp, and the previous rainbow asserted the opposite here.
    expect(luminance(low)).toBeGreaterThan(luminance(high));
  });

  it('exposes the underlying domain', () => {
    const scale = createColorScale({ values, mode: 'quantile', ramp: 'ember' });
    expect(scale.domain.mode).toBe('quantile');
    expect(scale.domain.min).toBe(0);
    expect(scale.domain.max).toBe(100);
  });

  it('exposes the ramp function', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'deepBlue' });
    expect(scale.ramp(0)).toBe(DEEP_BLUE_STOPS[0]);
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
    const scale = createColorScale({ values: skewed, mode: 'quantile', ramp: 'ember' });
    const colors = skewed.map((v) => scale(v));
    expect(new Set(colors).size).toBeGreaterThanOrEqual(9);
  });

  it('returns a stable mid color when every value is identical', () => {
    const scale = createColorScale({ values: [4, 4, 4], mode: 'linear', ramp: 'ember' });
    expect(scale(4)).toBe(scale(4));
    expect(parseHex(scale(4))).not.toBeNull();
  });

  it('returns a valid color for an empty dataset', () => {
    const scale = createColorScale({ values: [], mode: 'quantile', ramp: 'ember' });
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

describe('EMBER_STOPS on a light canvas', () => {
  it('gets strictly darker as values rise', () => {
    // The whole ordering of the map rests on this. A ramp that brightens
    // anywhere along its length has two steps that read as equally "high".
    const lums = EMBER_STOPS.map(luminance);
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]!, `step ${i}`).toBeLessThan(lums[i - 1]!);
    }
  });

  it('separates every adjacent step by lightness alone', () => {
    for (let i = 1; i < EMBER_STOPS.length; i += 1) {
      expect(contrast(EMBER_STOPS[i - 1]!, EMBER_STOPS[i]!), `pair ${i}`)
        .toBeGreaterThan(1.25);
    }
  });

  it('holds one hue from end to end', () => {
    // A sequential ramp encodes magnitude by lightness; a hue that drifts adds
    // a second, meaningless signal. Tolerance is generous because maximum
    // in-gamut chroma pulls the hue slightly at the extremes.
    const hues = EMBER_STOPS.map(hue);
    for (const h of hues) expect(Math.abs(h - hues[0]!)).toBeLessThan(0.35);
  });

  it('makes the high end unmistakable against the surface', () => {
    const top = EMBER_STOPS[EMBER_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(6);
  });

  it('keeps the lowest step readable as a value rather than as bare surface', () => {
    // It should recede, but not vanish: an unfilled region and a
    // barely-filled one must not look the same.
    const bottom = EMBER_STOPS[0]!;
    expect(contrast(bottom, MAP_BG)).toBeGreaterThan(1.1);
    expect(contrast(bottom, MAP_BG)).toBeLessThan(1.5);
  });

  it('carries inverse ink at the top of the ramp', () => {
    const top = EMBER_STOPS[EMBER_STOPS.length - 1]!;
    expect(contrast(top, '#f8fafc')).toBeGreaterThan(4.5);
  });

  it('is all six-digit hex', () => {
    for (const stop of EMBER_STOPS) expect(stop).toMatch(/^#[0-9a-f]{6}$/u);
  });
});

describe('DEEP_BLUE_STOPS on a light canvas', () => {
  it('gets strictly darker as values rise', () => {
    const lums = DEEP_BLUE_STOPS.map(luminance);
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]!, `step ${i}`).toBeLessThan(lums[i - 1]!);
    }
  });

  it('separates every adjacent step by lightness alone', () => {
    for (let i = 1; i < DEEP_BLUE_STOPS.length; i += 1) {
      expect(contrast(DEEP_BLUE_STOPS[i - 1]!, DEEP_BLUE_STOPS[i]!), `pair ${i}`)
        .toBeGreaterThan(1.25);
    }
  });

  it('never turns warm, which is what makes it safe under red-green CVD', () => {
    // A warm step would be exactly the confusion the alternative ramp exists
    // to avoid, so this guards the reason for the ramp, not just its values.
    for (const stop of DEEP_BLUE_STOPS) {
      const { r, b } = parseHex(stop)!;
      expect(b, stop).toBeGreaterThanOrEqual(r);
    }
  });

  it('keeps its high end visible', () => {
    const top = DEEP_BLUE_STOPS[DEEP_BLUE_STOPS.length - 1]!;
    expect(contrast(top, MAP_BG)).toBeGreaterThan(6);
  });

  it('has no false midpoint: no step is near-neutral', () => {
    // Its predecessor ran through a pale grey centre, which announced a
    // meaningful midpoint that crime counts do not have.
    for (const stop of DEEP_BLUE_STOPS.slice(1)) {
      expect(chroma(stop), stop).toBeGreaterThan(0.015);
    }
  });
});
