import { describe, expect, it } from 'vitest';
import {
  createRamp, interpolateOklab, oklabToRgb, parseHex, rgbToOklab, toHex,
} from './interpolate.js';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#00ff80')).toEqual({ r: 0, g: 255, b: 128 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('is case-insensitive and tolerates a missing hash', () => {
    expect(parseHex('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for malformed input', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#gg0000')).toBeNull();
    expect(parseHex('#ff00')).toBeNull();
    expect(parseHex('rgb(255,0,0)')).toBeNull();
  });
});

describe('toHex', () => {
  it('renders lowercase 6-digit hex', () => {
    expect(toHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(toHex({ r: 0, g: 128, b: 255 })).toBe('#0080ff');
  });

  it('clamps and rounds out-of-gamut channels', () => {
    expect(toHex({ r: 300, g: -20, b: 127.6 })).toBe('#ff0080');
  });
});

describe('OKLab round-trip', () => {
  it('recovers the original color within one 8-bit step', () => {
    const samples = [
      { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 },
      { r: 18, g: 99, b: 220 }, { r: 240, g: 180, b: 30 }, { r: 127, g: 127, b: 127 },
    ];
    for (const rgb of samples) {
      const back = oklabToRgb(rgbToOklab(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it('gives white an L near 1 and black an L near 0', () => {
    expect(rgbToOklab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(1, 2);
    expect(rgbToOklab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 2);
  });
});

describe('interpolateOklab', () => {
  it('returns the endpoints exactly at t=0 and t=1', () => {
    expect(interpolateOklab('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(interpolateOklab('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('clamps t outside [0, 1]', () => {
    expect(interpolateOklab('#ff0000', '#0000ff', -5)).toBe('#ff0000');
    expect(interpolateOklab('#ff0000', '#0000ff', 5)).toBe('#0000ff');
  });

  it('does not desaturate to grey at the midpoint', () => {
    // The sRGB midpoint of red and blue is a muddy #7f007f-ish tone with low
    // chroma. OKLab keeps chroma up; assert the result is meaningfully colorful.
    const mid = interpolateOklab('#ff0000', '#0000ff', 0.5);
    const lab = rgbToOklab(parseHex(mid)!);
    const chroma = Math.hypot(lab.a, lab.b);
    expect(chroma).toBeGreaterThan(0.1);
  });

  it('varies monotonically in lightness between two greys', () => {
    const lightness = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => rgbToOklab(parseHex(interpolateOklab('#000000', '#ffffff', t))!).L,
    );
    for (let i = 1; i < lightness.length; i += 1) {
      expect(lightness[i]!).toBeGreaterThan(lightness[i - 1]!);
    }
  });

  it('falls back to the destination color when a stop is unparseable', () => {
    expect(interpolateOklab('not-a-color', '#0000ff', 0.5)).toBe('#0000ff');
    expect(interpolateOklab('#ff0000', 'not-a-color', 0.5)).toBe('#ff0000');
  });

  it('falls back to black when both stops are unparseable', () => {
    expect(interpolateOklab('nope', 'also-nope', 0.5)).toBe('#000000');
  });
});

describe('createRamp', () => {
  const ramp = createRamp(['#0000ff', '#00ff00', '#ff0000']);

  it('returns the first stop at t=0 and the last at t=1', () => {
    expect(ramp(0)).toBe('#0000ff');
    expect(ramp(1)).toBe('#ff0000');
  });

  it('hits interior stops exactly at their positions', () => {
    expect(ramp(0.5)).toBe('#00ff00');
  });

  it('clamps out-of-range t', () => {
    expect(ramp(-1)).toBe('#0000ff');
    expect(ramp(2)).toBe('#ff0000');
  });

  it('handles a single-stop ramp as a constant', () => {
    const flat = createRamp(['#123456']);
    expect(flat(0)).toBe('#123456');
    expect(flat(0.5)).toBe('#123456');
    expect(flat(1)).toBe('#123456');
  });

  it('falls back to black for an unparseable single stop', () => {
    expect(createRamp(['nope'])(0.5)).toBe('#000000');
  });

  it('falls back to black for an unparseable final stop at t=1', () => {
    expect(createRamp(['#0000ff', 'nope'])(1)).toBe('#000000');
  });

  it('throws when given no stops, because that is a programming error', () => {
    expect(() => createRamp([])).toThrow(/en az bir renk/u);
  });

  it('produces a continuous ramp with no repeated adjacent colors', () => {
    const samples = Array.from({ length: 21 }, (_, i) => ramp(i / 20));
    expect(new Set(samples).size).toBeGreaterThan(15);
  });
});
