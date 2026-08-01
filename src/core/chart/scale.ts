export interface LinearScale {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  /** Domain value → range position. Clamped to the range. */
  toRange: (value: number) => number;
  /** Range position → domain value. Clamped to the domain. */
  toDomain: (position: number) => number;
}

function clamp(value: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (value < lo) return lo;
  return value > hi ? hi : value;
}

/**
 * A clamped linear mapping between a data domain and a pixel range.
 *
 * Both directions clamp. An unclamped scale is how a slider handle ends up
 * drawn outside its track and how a chart point lands off-canvas; there is no
 * caller here that wants extrapolation.
 *
 * A zero-width domain maps everything to the range start rather than dividing
 * by zero — a dataset covering a single year is ordinary, not exceptional.
 */
export function createLinearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  return {
    domain,
    range,
    toRange: (value) => (
      span === 0 ? r0 : clamp(r0 + ((value - d0) / span) * (r1 - r0), r0, r1)
    ),
    toDomain: (position) => (
      r1 - r0 === 0 || span === 0
        ? d0
        : clamp(d0 + ((position - r0) / (r1 - r0)) * span, d0, d1)
    ),
  };
}

/** Rounds to the nearest `min + n * step`. A non-positive step is a no-op. */
export function snapToStep(value: number, min: number, step: number): number {
  if (step <= 0) return value;
  return min + Math.round((value - min) / step) * step;
}
