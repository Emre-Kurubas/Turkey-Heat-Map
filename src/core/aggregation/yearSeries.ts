import type { GeoLevel } from '@/core/types/index.js';
import type { CrimeIndex } from './buildIndex.js';

export interface YearSeriesOptions {
  /** Empty means every category, matching FilterSet's convention. */
  categories: readonly string[];
  /** Restrict to one region. Omit for the whole country. */
  region?: { level: GeoLevel; code: string } | undefined;
}

/**
 * Total per year, over every year in the data.
 *
 * Deliberately not derived from a `rollup`, and deliberately blind to the year
 * filter. The trend chart is the control that *sets* that filter: fed a series
 * the filter had already narrowed, selecting 2020 would leave the chart holding
 * a single point, and there would be nothing left to click to get back or to
 * move to 2021. A selector cannot be filtered by its own selection.
 *
 * Category and region filters do apply — those narrow what is being counted
 * rather than which years are on offer.
 */
export function totalsByYear(
  index: CrimeIndex,
  options: YearSeriesOptions,
): Map<number, number> {
  const { categories, region } = options;
  const categoryFilter = categories.length === 0 ? null : new Set(categories);

  const out = new Map<number, number>();
  for (const record of index.records) {
    if (categoryFilter !== null && !categoryFilter.has(record.category)) continue;
    if (region !== undefined) {
      const code = region.level === 'il' ? record.ilCode : record.ilceCode;
      if (code !== region.code) continue;
    }
    out.set(record.year, (out.get(record.year) ?? 0) + record.count);
  }
  return out;
}
