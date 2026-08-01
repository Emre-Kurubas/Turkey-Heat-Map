import type { ScaleMode } from '@/core/types/index.js';
import { type ColorDomain, createColorDomain } from './domain.js';
import { createRamp } from './interpolate.js';

export type RampFn = (t: number) => string;
export type ColorScaleName = 'spectral' | 'blueRed';

/**
 * Default heat ramp: cool for low crime counts, warm for high.
 * Matches the reference design. Note that rainbow ramps are not fully
 * colorblind-safe, which is why the UI always shows numbers alongside color.
 */
/**
 * The default map ramp, for a light canvas.
 *
 * Each stop is solved to a target luminance rather than picked by eye, so the
 * ramp darkens monotonically from 0.782 to 0.061 while keeping the spectral
 * hue journey. That matters more here than on a dark canvas: with a pale
 * background, magnitude has to read by lightness as well as hue, and the
 * previous ramp — dark blue, light yellow, dark red — had its lightest stops
 * in the middle, so mid-range values washed out at 1.36 contrast.
 *
 * The lowest stop deliberately sits close to the surface. On a choropleth,
 * "near zero" is supposed to recede.
 */
export const SPECTRAL_STOPS: readonly string[] = [
  '#dbe6f4', // solmuş mavi  — en düşük
  '#acd0ea',
  '#5ac0cf',
  '#39ab72',
  '#9c7a16',
  '#a14e12',
  '#871d13', // koyu kırmızı — en yüksek
];

/**
 * Colorblind-friendlier alternative: no green, relies on the blue↔red axis.
 * Re-stepped for the light canvas — the original's pale middle and light arms
 * were built against a dark background, where they read as bright rather than
 * as absent.
 */
export const BLUE_RED_STOPS: readonly string[] = [
  '#c6dbef',
  '#83aed4',
  '#4a80b4',
  '#dcdcdc',
  '#d98f77',
  '#bf5b40',
  '#93231a',
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
  spectral: createRamp(SPECTRAL_STOPS),
  blueRed: createRamp(BLUE_RED_STOPS),
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
