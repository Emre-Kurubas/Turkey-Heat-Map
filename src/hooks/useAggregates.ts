import { useMemo } from 'react';
import {
  buildIndex, buildPopulationIndex, rollup, toPerCapita,
  type CrimeIndex, type RollupResult,
} from '@/core/aggregation/index.js';
import {
  createColorScale, type ColorScale, type ColorScaleName, type RampFn,
} from '@/core/color/index.js';
import type {
  CrimeCategory, CrimeRecord, GeoLevel, RegionPopulation,
} from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { useHeatMapState } from './useHeatMapState.js';

export interface AggregatesInput {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  colorScale: ColorScaleName | RampFn;
  /** Required for the per-capita metric; without it the metric stays on totals. */
  population?: readonly RegionPopulation[] | undefined;
}

export interface AggregateResult {
  index: CrimeIndex;
  /**
   * Rollup at the level currently outlined and interacted with. Drives the
   * tooltip and the region-click payload.
   */
  rollup: RollupResult;
  /**
   * Rollup at `heatLevel`. Drives the colours and therefore the legend, so the
   * heat keeps district resolution at every zoom.
   */
  heatRollup: RollupResult;
  /** Built from `heatRollup`, so the legend always describes what is painted. */
  scale: ColorScale;
  /**
   * The level the heat is painted at — `ilce` whenever the data supports it.
   * Falls back to `il` for a dataset with no district codes, because an ilçe
   * rollup of il-only records is empty and would paint the whole map as
   * no-data.
   */
  heatLevel: GeoLevel;
  /** Region code → display name at the outline level. */
  names: ReadonlyMap<string, string>;
}

function namesFor(level: GeoLevel): ReadonlyMap<string, string> {
  const meta = getLevelRegionMeta(level);
  return new Map([...meta].map(([code, region]) => [code, region.name]));
}

/**
 * The single path from raw records to something paintable.
 *
 * Separate memos, not one, because they invalidate on different things: the
 * index only on the data identity, each rollup on filters and its own level,
 * the scale on the heat rollup's values. Collapsing them would rebuild and
 * re-validate ~78k records on every filter tick and blow the §9 budget.
 *
 * `data` and `categories` are compared by reference (§8) — a consumer that
 * builds either array inline in render defeats all of this.
 */
export function useAggregates(input: AggregatesInput): AggregateResult {
  const { data, categories, colorScale, population } = input;
  const level = useHeatMapState((state) => state.level);
  const filters = useHeatMapState((state) => state.filters);
  const scaleMode = useHeatMapState((state) => state.scaleMode);
  const metric = useHeatMapState((state) => state.metric);

  const index = useMemo(() => {
    const knownIlceCodes = new Set(getLevelRegionMeta('ilce').keys());
    return buildIndex({ data, categories, knownIlceCodes });
  }, [data, categories]);

  const heatLevel: GeoLevel = index.hasIlceData ? 'ilce' : 'il';

  const names = useMemo(() => namesFor(level), [level]);

  const rolled = useMemo(() => rollup(index, level, filters), [index, level, filters]);

  const heatRolled = useMemo(
    () => (heatLevel === level ? rolled : rollup(index, heatLevel, filters)),
    [index, heatLevel, level, filters, rolled],
  );

  // Per-capita restates the counts as a rate. Without population data the
  // metric silently stays on totals — reconcileProps already warned about it,
  // and a NaN-filled map would be a worse answer than an honest count.
  const ratePossible = metric === 'perCapita' && population !== undefined;

  const rated = useMemo(() => {
    if (!ratePossible) return rolled;
    return toPerCapita(rolled, buildPopulationIndex(population, level, filters.yearRange));
  }, [ratePossible, population, rolled, level, filters.yearRange]);

  const ratedHeat = useMemo(() => {
    if (!ratePossible) return heatRolled;
    if (heatLevel === level) return rated;
    return toPerCapita(
      heatRolled,
      buildPopulationIndex(population, heatLevel, filters.yearRange),
    );
  }, [ratePossible, population, heatRolled, heatLevel, level, rated, filters.yearRange]);

  // The domain comes from the heat level alone. Mixing levels here would let
  // the colours mean one thing and the legend say another (§6.5).
  const scale = useMemo(
    () => createColorScale({ values: ratedHeat.values, mode: scaleMode, ramp: colorScale }),
    [ratedHeat, scaleMode, colorScale],
  );

  return { index, rollup: rated, heatRollup: ratedHeat, scale, heatLevel, names };
}
