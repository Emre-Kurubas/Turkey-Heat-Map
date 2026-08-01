import { useMemo } from 'react';
import {
  buildIndex, rollup, type CrimeIndex, type RollupResult,
} from '@/core/aggregation/index.js';
import {
  createColorScale, type ColorScale, type ColorScaleName, type RampFn,
} from '@/core/color/index.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { useHeatMapState } from './useHeatMapState.js';

export interface AggregatesInput {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  colorScale: ColorScaleName | RampFn;
}

export interface AggregateResult {
  index: CrimeIndex;
  rollup: RollupResult;
  scale: ColorScale;
  /** Region code → display name, for tooltip and legend labels. */
  names: ReadonlyMap<string, string>;
}

/**
 * The single path from raw records to something paintable.
 *
 * Four separate memos, not one, because they invalidate on different things:
 * the index only on the data identity, the rollup on filters and level, the
 * scale on the rollup's values. Collapsing them would rebuild and re-validate
 * ~78k records on every filter tick and blow the §9 budget.
 *
 * `data` and `categories` are compared by reference (§8) — a consumer that
 * builds either array inline in render defeats all of this.
 */
export function useAggregates(input: AggregatesInput): AggregateResult {
  const { data, categories, colorScale } = input;
  const level = useHeatMapState((state) => state.level);
  const filters = useHeatMapState((state) => state.filters);
  const scaleMode = useHeatMapState((state) => state.scaleMode);

  const names = useMemo(() => {
    const meta = getLevelRegionMeta(level);
    return new Map([...meta].map(([code, region]) => [code, region.name]));
  }, [level]);

  const index = useMemo(() => {
    const knownIlceCodes = new Set(getLevelRegionMeta('ilce').keys());
    return buildIndex({ data, categories, knownIlceCodes });
  }, [data, categories]);

  const rolled = useMemo(() => rollup(index, level, filters), [index, level, filters]);

  // Domains are computed per level: il and ilçe magnitudes differ by an order of
  // magnitude and must not share a scale (§6.5).
  const scale = useMemo(
    () => createColorScale({ values: rolled.values, mode: scaleMode, ramp: colorScale }),
    [rolled, scaleMode, colorScale],
  );

  return { index, rollup: rolled, scale, names };
}
