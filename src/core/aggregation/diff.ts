import type { RollupResult } from './rollup.js';

export interface RegionDiff {
  readonly code: string;
  readonly a: number;
  readonly b: number;
  /** a − b. Positive means A is higher. */
  readonly delta: number;
  /** (a − b) / b. null when b is 0. */
  readonly pctDelta: number | null;
}

export interface DiffResult {
  readonly byRegion: ReadonlyMap<string, RegionDiff>;
  /** Largest |delta|, for createDiffColorScale. */
  readonly maxAbsDelta: number;
  readonly totalA: number;
  readonly totalB: number;
}

/**
 * Compares two rollups region by region for compare mode.
 *
 * The region set is the union of both sides, so a region that appears in only
 * one filter set still shows up — a district that went from zero crimes to forty
 * is exactly the change a reader is looking for, and dropping it would hide a
 * new hotspot.
 */
export function diffRollups(a: RollupResult, b: RollupResult): DiffResult {
  const codes = new Set<string>([...a.byRegion.keys(), ...b.byRegion.keys()]);
  const byRegion = new Map<string, RegionDiff>();
  let maxAbsDelta = 0;

  for (const code of codes) {
    const valueA = a.byRegion.get(code)?.total ?? 0;
    const valueB = b.byRegion.get(code)?.total ?? 0;
    const delta = valueA - valueB;

    // A zero baseline has no meaningful ratio. Returning null rather than
    // Infinity keeps the "undefined change" case visible all the way to the UI,
    // where it renders as an em dash instead of a nonsensical percentage.
    let pctDelta: number | null;
    if (valueB !== 0) pctDelta = delta / valueB;
    else if (valueA === 0) pctDelta = 0;
    else pctDelta = null;

    byRegion.set(code, { code, a: valueA, b: valueB, delta, pctDelta });
    const magnitude = Math.abs(delta);
    if (magnitude > maxAbsDelta) maxAbsDelta = magnitude;
  }

  return { byRegion, maxAbsDelta, totalA: a.total, totalB: b.total };
}
