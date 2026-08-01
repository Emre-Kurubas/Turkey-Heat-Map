import { describe, expect, it } from 'vitest';
import { parseHex, rgbToOklab } from './interpolate.js';
import { DEEP_BLUE_STOPS, SPECTRAL_STOPS, createColorScale } from './scales.js';

function hue(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.atan2(lab.b, lab.a);
}
function chroma(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.hypot(lab.a, lab.b);
}

/** Straight-line distance in OKLab — a perceptual "how different are these". */
function deltaE(a: string, b: string): number {
  const x = rgbToOklab(parseHex(a)!);
  const y = rgbToOklab(parseHex(b)!);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

/**
 * Hue in degrees, unwrapped so a ramp that crosses the ±180° seam still reads
 * as one continuous run. Without this, cyan (−155°) → green (+164°) looks like
 * a 319° jump forwards when it is really 41° further along the same arc.
 */
function unwrappedHues(stops: readonly string[]): number[] {
  const out: number[] = [];
  let previous = 0;
  stops.forEach((stop, index) => {
    const raw = (hue(stop) * 180) / Math.PI;
    if (index === 0) {
      out.push(raw);
      previous = raw;
      return;
    }
    const shifted = raw - 360 * Math.round((raw - previous) / 360);
    out.push(shifted);
    previous = shifted;
  });
  return out;
}

describe('stop definitions', () => {
  it('defines the default ramp with enough steps to read as a gradient', () => {
    expect(SPECTRAL_STOPS.length).toBeGreaterThanOrEqual(5);
    expect(SPECTRAL_STOPS[0]).toMatch(/^#[\da-f]{6}$/u);
    expect(SPECTRAL_STOPS.at(-1)).toMatch(/^#[\da-f]{6}$/u);
  });

  it('gives every stop a valid hex value', () => {
    for (const stops of [SPECTRAL_STOPS, DEEP_BLUE_STOPS]) {
      for (const stop of stops) expect(parseHex(stop)).not.toBeNull();
    }
  });

});

describe('createColorScale', () => {
  const values = [0, 25, 50, 75, 100];

  it('maps the lowest value to the blue end and the highest to the red end', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'spectral' });
    const low = scale(0);
    const high = scale(100);
    expect(low).toBe(SPECTRAL_STOPS[0]);
    expect(high).toBe(SPECTRAL_STOPS.at(-1));
    // The ends differ by hue, not by lightness — a spectral ramp's blue and red
    // are close in luminance by construction, so asserting darkness here would
    // be asserting a coincidence.
    expect(parseHex(low)!.b).toBeGreaterThan(parseHex(low)!.r);
    expect(parseHex(high)!.r).toBeGreaterThan(parseHex(high)!.b);
  });

  it('exposes the underlying domain', () => {
    const scale = createColorScale({ values, mode: 'quantile', ramp: 'spectral' });
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
  it('advances its hue in one direction at every step', () => {
    // This is what orders a spectral ramp, in place of the lightness ordering a
    // single-hue ramp gets for free. A step that doubles back on the hue arc
    // puts the same colour at two different values.
    const hues = unwrappedHues(SPECTRAL_STOPS);
    for (let i = 1; i < hues.length; i += 1) {
      expect(hues[i]!, `step ${i}`).toBeLessThan(hues[i - 1]!);
    }
  });

  it('covers a wide enough arc for the ends to be unmistakable', () => {
    const hues = unwrappedHues(SPECTRAL_STOPS);
    expect(hues[0]! - hues.at(-1)!).toBeGreaterThan(180);
  });

  it('separates every adjacent step perceptually', () => {
    // In OKLab distance rather than in contrast: two neighbours here can share a
    // lightness and still be plainly different colours, which contrast alone
    // would score as identical.
    for (let i = 1; i < SPECTRAL_STOPS.length; i += 1) {
      expect(deltaE(SPECTRAL_STOPS[i - 1]!, SPECTRAL_STOPS[i]!), `pair ${i}`)
        .toBeGreaterThan(0.05);
    }
  });

  it('never passes through grey, which is where a stop starts reading as no-data', () => {
    // The no-data fill is a near-neutral wash. Any stop that drifts toward the
    // neutral axis competes with it, and "few records" would read as "none".
    for (const stop of SPECTRAL_STOPS) {
      expect(chroma(stop), stop).toBeGreaterThan(0.08);
    }
  });

  it('travels from blue to red, ends included', () => {
    const first = parseHex(SPECTRAL_STOPS[0]!)!;
    const last = parseHex(SPECTRAL_STOPS[SPECTRAL_STOPS.length - 1]!)!;
    expect(first.b).toBeGreaterThan(first.r);
    expect(last.r).toBeGreaterThan(last.b);
  });

  it('makes both ends stand out against the surface', () => {
    // Only the ends. The yellow through the middle clears the surface by 1.27
    // and that is inherent to the ramp: its middle is the lightest part of the
    // spectrum. Requiring lightness contrast all the way along would be
    // requiring a different ramp.
    expect(contrast(SPECTRAL_STOPS.at(-1)!, MAP_BG)).toBeGreaterThan(4);
    expect(contrast(SPECTRAL_STOPS[0]!, MAP_BG)).toBeGreaterThan(3);
  });

  it('keeps every step clear of the surface it is painted on', () => {
    // Weaker than a contrast bound, and the right test for a ramp whose middle
    // is pale: a stop may be light, but it must never be *this* light-and-grey.
    for (const stop of SPECTRAL_STOPS) {
      expect(deltaE(stop, MAP_BG), stop).toBeGreaterThan(0.1);
    }
  });

  it('is all six-digit hex', () => {
    for (const stop of SPECTRAL_STOPS) expect(stop).toMatch(/^#[0-9a-f]{6}$/u);
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
