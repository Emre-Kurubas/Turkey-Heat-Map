import type { ScaleMode } from '@/core/types/index.js';

export interface ColorDomain {
  readonly mode: ScaleMode;
  readonly min: number;
  readonly max: number;
  /** Ascending, deduplicated observed values. Populated only for quantile mode. */
  readonly sorted: readonly number[];
  /** Maps a value to [0, 1]. Always clamped; never returns NaN. */
  toT(value: number): number;
}

/** Position used when a value carries no ranking information. */
const NEUTRAL_T = 0.5;

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Index of the first element strictly greater than `target`.
 * Standard upper-bound binary search; O(log n) per lookup, which matters
 * because this runs once per region on every filter change.
 */
function upperBound(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid]! <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Builds a value→position mapping for a color ramp.
 *
 * - `linear`  — position is proportional to magnitude. Answers "how many".
 * - `log`     — compresses the top of a skewed range. Compromise between the two.
 * - `quantile`— position is proportional to rank. Answers "how does this compare".
 *
 * Quantile is the library default because Turkish crime counts are dominated by
 * a handful of metropolitan provinces; under a linear domain the other ~78 would
 * be visually identical.
 */
export function createColorDomain(
  values: readonly number[],
  mode: ScaleMode,
): ColorDomain {
  const finite = values.filter((v) => Number.isFinite(v));

  if (finite.length === 0) {
    return { mode, min: 0, max: 0, sorted: [], toT: () => NEUTRAL_T };
  }

  let min = finite[0]!;
  let max = finite[0]!;
  for (const value of finite) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  // No spread means no ranking. A neutral mid-tone is honest; 0 would falsely
  // read as "lowest in the country".
  if (min === max) {
    return { mode, min, max, sorted: [min], toT: () => NEUTRAL_T };
  }

  if (mode === 'quantile') {
    const sorted = [...new Set(finite)].sort((a, b) => a - b);
    const lastIndex = sorted.length - 1;

    return {
      mode, min, max, sorted,
      toT(value: number): number {
        if (!Number.isFinite(value)) return NEUTRAL_T;
        if (value <= min) return 0;
        if (value >= max) return 1;

        const upper = upperBound(sorted, value);
        const lowerIndex = upper - 1;
        const lowerValue = sorted[lowerIndex]!;

        // Exact hit on an observed value: its rank position.
        if (lowerValue === value) return lowerIndex / lastIndex;

        // Between two observed values: interpolate within that rank interval so
        // the mapping stays strictly monotonic.
        const upperValue = sorted[upper]!;
        const withinInterval = (value - lowerValue) / (upperValue - lowerValue);
        return (lowerIndex + withinInterval) / lastIndex;
      },
    };
  }

  if (mode === 'log') {
    // log1p needs a non-negative argument, so shift the whole domain to start at 0.
    const span = Math.log1p(max - min);
    return {
      mode, min, max, sorted: [],
      toT(value: number): number {
        if (!Number.isFinite(value)) return NEUTRAL_T;
        return clamp01(Math.log1p(Math.max(0, value - min)) / span);
      },
    };
  }

  const span = max - min;
  return {
    mode, min, max, sorted: [],
    toT(value: number): number {
      if (!Number.isFinite(value)) return NEUTRAL_T;
      return clamp01((value - min) / span);
    },
  };
}
