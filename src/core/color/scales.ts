import type { ScaleMode } from '@/core/types/index.js';
import { type ColorDomain, createColorDomain } from './domain.js';
import { createRamp } from './interpolate.js';

export type RampFn = (t: number) => string;
export type ColorScaleName = 'ember' | 'deepBlue';

/**
 * The default map ramp: blue for low, red for high, continuous in between.
 *
 * The stops are control points, not the palette. `createRamp` interpolates
 * between them in OKLab, so the map paints every tone along the path — the
 * nine values below are just where the curve is pinned.
 *
 * Three things make a blue→red ramp work rather than turn to mud. The hue path
 * runs 264° → 392° through violet and magenta, never through grey or olive,
 * which is where two-hue ramps usually die. Lightness falls the whole way,
 * 0.682 → 0.057, so magnitude still reads if hue does not: the ramp survives
 * greyscale printing and red-green colour blindness even though it is built
 * from exactly the two hues that confusion affects.
 *
 * And chroma dips through the middle rather than peaking there. Following the
 * gamut ceiling put a neon violet across the mid-range that shouted louder
 * than the dark red at the top, which inverts what the map is trying to say.
 * The first attempt overcorrected the other way: holding chroma low at the
 * pale end made the bottom half a wash of grey-lavender with no blue visible
 * anywhere, so the ramp read as one colour rather than two.
 *
 * Every adjacent pair clears 1.22 contrast and the lowest stop clears the map
 * surface by 1.27, so "few records" reads as a value rather than as a hole.
 */
export const EMBER_STOPS: readonly string[] = [
  '#cbd8f1', // mavi        — en düşük
  '#b7c3e8',
  '#aaacdd',
  '#a492d3',
  '#ab6ecc',
  '#ab53a4',
  '#a14075',
  '#942e46',
  '#7e2314', // koyu kırmızı — en yüksek
];

/**
 * The colourblind-safe alternative: a single blue, same construction.
 *
 * Its predecessor ran blue through a pale middle to red, which is a *diverging*
 * ramp — it announces a meaningful midpoint. Crime counts have no such
 * midpoint, so that shape invented one. This one has no red/green axis at all,
 * which is what makes it safe under deuteranopia and protanopia, and no false
 * centre.
 */
export const DEEP_BLUE_STOPS: readonly string[] = [
  '#d9dee7',
  '#b1c1d9',
  '#85a4d3',
  '#5486d1',
  '#366ab5',
  '#25508d',
  '#183765',
];

/** Diverging ramp for compare mode: blue = decrease, neutral = unchanged, red = increase. */
export const DIFF_STOPS: readonly string[] = [
  '#2166ac',
  '#7fb1d6',
  '#d6e6f0',
  '#f2f2f2', // merkez — değişim yok
  '#f7ddd0',
  '#e0866a',
  '#b2182b',
];

export const RAMPS: Readonly<Record<ColorScaleName, RampFn>> = {
  ember: createRamp(EMBER_STOPS),
  deepBlue: createRamp(DEEP_BLUE_STOPS),
};

const DIFF_RAMP: RampFn = createRamp(DIFF_STOPS);

export interface ColorScale {
  (value: number): string;
  readonly domain: ColorDomain;
  readonly ramp: RampFn;
}

export interface ColorScaleOptions {
  values: readonly number[];
  mode: ScaleMode;
  ramp: ColorScaleName | RampFn;
}

function attach(domain: ColorDomain, ramp: RampFn): ColorScale {
  const scale = ((value: number) => ramp(domain.toT(value))) as ColorScale;
  return Object.assign(scale, { domain, ramp });
}

/** Builds a value→color scale from observed values, a domain mode, and a ramp. */
export function createColorScale(options: ColorScaleOptions): ColorScale {
  const ramp = typeof options.ramp === 'function' ? options.ramp : RAMPS[options.ramp];
  return attach(createColorDomain(options.values, options.mode), ramp);
}

/**
 * Builds the symmetric diverging scale used in compare mode.
 *
 * The domain is forced to [-max, +max] so that zero always lands on the neutral
 * center color. An asymmetric domain would put the neutral color at a nonzero
 * delta, which would make "no change" appear as a change.
 */
export function createDiffColorScale(maxAbsDelta: number): ColorScale {
  const bound = Math.abs(maxAbsDelta);
  const domain = createColorDomain([-bound, 0, bound], 'linear');
  return attach(domain, DIFF_RAMP);
}
