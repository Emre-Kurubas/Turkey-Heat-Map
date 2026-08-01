import { formatTrNumber } from '@/core/format/index.js';
import type { ColorDomain } from './domain.js';
import type { ColorScale } from './scales.js';

export interface LegendBreak {
  from: number;
  to: number;
  color: string;
  /** Pre-formatted Turkish label. */
  label: string;
}

const MIN_BUCKETS = 1;
const MAX_BUCKETS = 12;
/** U+2013 EN DASH, the correct connector for a numeric range. */
const RANGE_DASH = '–';

function clampBucketCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_BUCKETS;
  return Math.min(MAX_BUCKETS, Math.max(MIN_BUCKETS, Math.floor(count)));
}

/**
 * Finds the value whose position is `targetT`.
 *
 * Bisection rather than a closed-form inverse: `ColorDomain.toT` is monotonic but
 * not analytically invertible in quantile mode, and 40 iterations converge well
 * below the precision the legend displays. This runs a handful of times per
 * legend render, so the cost is irrelevant.
 */
function invertT(domain: ColorDomain, targetT: number, min: number, max: number): number {
  let low = min;
  let high = max;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (domain.toT(mid) < targetT) low = mid;
    else high = mid;
  }
  return Math.round((low + high) / 2);
}

/**
 * Splits a color scale into labelled legend buckets.
 *
 * Boundaries are derived by inverting the scale's own `t` positions rather than
 * by slicing the value range evenly. That matters for quantile domains: even
 * value steps would misrepresent where the color actually changes, and the
 * legend would not describe the map it sits next to.
 */
export function computeLegendBreaks(scale: ColorScale, count: number): LegendBreak[] {
  const { domain } = scale;
  const { min, max } = domain;

  if (min === max) {
    return [{
      from: min, to: max,
      color: scale(min),
      label: formatTrNumber(min),
    }];
  }

  const buckets = clampBucketCount(count);
  const boundaries: number[] = [min];

  for (let i = 1; i < buckets; i += 1) {
    boundaries.push(invertT(domain, i / buckets, min, max));
  }
  boundaries.push(max);

  const breaks: LegendBreak[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = boundaries[i]!;
    const to = boundaries[i + 1]!;
    breaks.push({
      from, to,
      color: scale((from + to) / 2),
      label: `${formatTrNumber(from)} ${RANGE_DASH} ${formatTrNumber(to)}`,
    });
  }

  return breaks;
}
