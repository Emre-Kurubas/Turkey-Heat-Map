import type { ScaleMode } from '@/core/types/index.js';
import { type ColorDomain, createColorDomain } from './domain.js';
import { createRamp } from './interpolate.js';

export type RampFn = (t: number) => string;
export type ColorScaleName = 'spectral' | 'deepBlue';

/**
 * The default map ramp: blue for low, red for high, the spectrum in between.
 *
 * The stops are control points, not the palette. `createRamp` interpolates
 * between them in OKLab, so the map paints every tone along the path — the ten
 * values below are just where the curve is pinned.
 *
 * This is a spectral ramp, and that is a deliberate trade. A single-hue ramp
 * orders itself by lightness alone, which no reader has to be taught; a
 * spectral one does not, so the legend carries more of the load. What it buys
 * is that adjacent levels are far easier to tell apart — on a country of 81
 * provinces where most values crowd the low end, hue separates neighbours that
 * lightness alone leaves nearly identical.
 *
 * Two properties keep it from turning to mud. The hue path advances in one
 * direction at every step, 262° through cyan, green and yellow down to 31°,
 * never doubling back — a ramp that reverses hue has two stops that read as the
 * same value. And chroma never falls below 0.10, so no stop drifts toward the
 * neutral surface underneath it and reads as "no data".
 *
 * The cost is lightness: the yellow through the middle clears the map surface
 * by only 1.27, against 4.21 at the blue end and 4.62 at the red. Magnitude
 * therefore reads by hue, not by darkness, which is why `deepBlue` exists as
 * the colourblind-safe alternative.
 */
export const SPECTRAL_STOPS: readonly string[] = [
  '#3b6fd4', // mavi    — en düşük
  '#3a95cf',
  '#3fb5c1', // camgöbeği
  '#56c79a',
  '#86d266', // yeşil
  '#bcdb4e',
  '#f0d848', // sarı
  '#f2a63c',
  '#e2702e', // turuncu
  '#c93520', // kırmızı — en yüksek
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

export const RAMPS: Readonly<Record<ColorScaleName, RampFn>> = {
  spectral: createRamp(SPECTRAL_STOPS),
  deepBlue: createRamp(DEEP_BLUE_STOPS),
};

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
