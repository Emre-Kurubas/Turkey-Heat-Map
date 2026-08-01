/**
 * sRGB ↔ OKLab conversion and perceptually-uniform interpolation.
 *
 * Interpolating in sRGB drags the path through low-chroma territory, so a blue→red
 * ramp passes through a muddy grey-purple. OKLab is perceptually uniform: equal
 * steps in the space look like equal steps to the eye, so the ramp stays vivid and
 * the midpoint reads as the midpoint.
 *
 * Matrices from Björn Ottosson's OKLab derivation.
 */

export interface RGB { r: number; g: number; b: number }
export interface Oklab { L: number; a: number; b: number }

const HEX_PATTERN = /^#?(?:([\da-f]{3})|([\da-f]{6}))$/iu;

const BLACK: RGB = { r: 0, g: 0, b: 0 };

/** Parses `#rgb`, `#rrggbb`, with or without the hash. Returns null if malformed. */
export function parseHex(hex: string): RGB | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (match === null) return null;

  const short = match[1];
  const full = match[2] ?? (short === undefined ? undefined : short.replace(/./gu, '$&$&'));
  if (full === undefined) return null;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function clampChannel(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

/** Renders an RGB triple as lowercase `#rrggbb`, clamping out-of-gamut channels. */
export function toHex({ r, g, b }: RGB): string {
  const hex = (value: number): string => clampChannel(value).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** sRGB gamma decode: 0..255 → linear 0..1. */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB gamma encode: linear 0..1 → 0..255. */
function fromLinear(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return c * 255;
}

export function rgbToOklab(rgb: RGB): Oklab {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = 0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b;
  const m = 0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b;
  const s = 0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.210_454_255_3 * l_ + 0.793_617_785_0 * m_ - 0.004_072_046_8 * s_,
    a: 1.977_998_495_1 * l_ - 2.428_592_205_0 * m_ + 0.450_593_709_9 * s_,
    b: 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766_0 * s_,
  };
}

export function oklabToRgb(lab: Oklab): RGB {
  const l_ = lab.L + 0.396_337_777_4 * lab.a + 0.215_803_757_3 * lab.b;
  const m_ = lab.L - 0.105_561_345_8 * lab.a - 0.063_854_172_8 * lab.b;
  const s_ = lab.L - 0.089_484_177_5 * lab.a - 1.291_485_548_0 * lab.b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: fromLinear(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s),
    g: fromLinear(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s),
    b: fromLinear(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701_0 * s),
  };
}

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Interpolates between two hex colors through OKLab.
 * If a stop is unparseable, returns the other stop rather than throwing —
 * a bad color in a theme should degrade, not break the render.
 */
export function interpolateOklab(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (a === null) return toHex(b ?? BLACK);
  if (b === null) return toHex(a);

  const clamped = clamp01(t);
  if (clamped === 0) return toHex(a);
  if (clamped === 1) return toHex(b);

  const labA = rgbToOklab(a);
  const labB = rgbToOklab(b);

  return toHex(oklabToRgb({
    L: labA.L + (labB.L - labA.L) * clamped,
    a: labA.a + (labB.a - labA.a) * clamped,
    b: labA.b + (labB.b - labA.b) * clamped,
  }));
}

/**
 * Builds a multi-stop ramp. Stops are spaced evenly across [0, 1].
 * Throws on an empty stop list: that is a programming error in the caller's
 * configuration, not a data error, and should surface immediately.
 */
export function createRamp(stops: readonly string[]): (t: number) => string {
  if (stops.length === 0) {
    throw new Error('createRamp: en az bir renk durağı gerekli.');
  }

  const first = stops[0]!;
  if (stops.length === 1) {
    const constant = toHex(parseHex(first) ?? BLACK);
    return () => constant;
  }

  const segments = stops.length - 1;
  const last = toHex(parseHex(stops[segments]!) ?? BLACK);

  return (t: number): string => {
    const clamped = clamp01(t);
    if (clamped === 1) return last;

    const scaled = clamped * segments;
    const index = Math.floor(scaled);
    return interpolateOklab(stops[index]!, stops[index + 1]!, scaled - index);
  };
}
