import type { ScaleMode } from '@/core/types/index.js';
import { type ColorDomain, createColorDomain } from './domain.js';
import { createRamp } from './interpolate.js';

export type RampFn = (t: number) => string;
export type ColorScaleName = 'ember' | 'deepBlue';

/**
 * The default map ramp: one hue, light to dark.
 *
 * This replaced a spectral rainbow — blue, cyan, green, olive, orange, red —
 * and the reason is worth keeping. A rainbow has no intrinsic order: nothing
 * about green says it is more than cyan, so the reader has to consult the
 * legend for every single region. Worse on a pale canvas, the hues that fall
 * between the ends land on olive and teal, and the map reads as mud rather
 * than as a gradient. A single hue darkening toward the top has the order
 * built into it and needs the legend only for the numbers.
 *
 * Each stop is solved rather than picked: even steps of OKLab lightness from
 * 0.90 down to 0.40, each at the largest chroma still in gamut at that
 * lightness, scaled by a curve that keeps the pale end from going chalky.
 * The result darkens monotonically (relative luminance 0.726 → 0.059, a 12.3×
 * span) with every adjacent pair separated by at least 1.33 contrast.
 *
 * The lowest stop is a warm tint rather than the surface itself: it clears
 * `--hm-map-bg` by 1.20 and the no-data fill by 1.09, so "few records" still
 * reads as a measured value and not as a hole in the map.
 */
export const EMBER_STOPS: readonly string[] = [
  '#e8dbd5', // soluk kum   — en düşük
  '#e3b8a5',
  '#e88f64',
  '#d96b30',
  '#bc5311',
  '#9a3f00',
  '#762f00', // koyu kor    — en yüksek
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
