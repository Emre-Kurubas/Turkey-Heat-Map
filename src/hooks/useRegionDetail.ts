import { useMemo } from 'react';
import type { DetailTarget } from '@/context/HeatMapStore.js';
import {
  rollup, totalsByYear, type CrimeIndex, type RankedRegion,
} from '@/core/aggregation/index.js';
import { compareTurkish } from '@/core/search/index.js';
import type { CrimeCategory, FilterSet, GeoLevel } from '@/core/types/index.js';
import { ilCodeFromIlceCode } from '@/core/geo/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';

export interface DetailCategory {
  id: string;
  label: string;
  value: number;
  /** Fraction of the region's total, 0..1. */
  share: number;
}

export interface RegionDetailData {
  code: string;
  level: GeoLevel;
  name: string;
  total: number;
  /** Largest first. Categories with no records here are omitted. */
  categories: readonly DetailCategory[];
  /**
   * This region's total per year, across the whole data span. The year filter
   * is not applied: the chart drawn from this is what sets that filter.
   */
  byYear: ReadonlyMap<number, number>;
  /**
   * The districts inside this province, largest first. Empty for a district
   * target, which has nothing below it.
   *
   * `share` is of the *province* total, not the national one — the panel is
   * answering "how is this province distributed", and a national share would
   * put 0,4% next to every row and say nothing.
   */
  children: readonly RankedRegion[];
}

/** Districts of one province, ranked, with shares relative to that province. */
function rankChildren(
  index: CrimeIndex,
  filters: FilterSet,
  ilCode: string,
): RankedRegion[] {
  const districts = rollup(index, 'ilce', filters);
  const names = getLevelRegionMeta('ilce');

  const mine = [...districts.byRegion.values()]
    .filter((aggregate) => ilCodeFromIlceCode(aggregate.code) === ilCode);

  // The parent's own total, so the shares sum to 100% across these rows. Taken
  // from the districts rather than from the province rollup: a record carrying
  // no district code counts toward the province and toward none of these rows,
  // and dividing by a total that included it would leave the column short.
  const subtotal = mine.reduce((sum, aggregate) => sum + aggregate.total, 0);

  return mine
    .map((aggregate) => ({
      code: aggregate.code,
      name: names.get(aggregate.code)?.name ?? aggregate.code,
      total: aggregate.total,
      share: subtotal === 0 ? 0 : aggregate.total / subtotal,
      rank: 0,
    }))
    // Ties break alphabetically, so the order is stable across renders rather
    // than depending on Map insertion order.
    .sort((a, b) => b.total - a.total || compareTurkish(a.name, b.name))
    .map((row, position) => ({ ...row, rank: position + 1 }));
}

/**
 * Everything the detail panel shows, for one region.
 *
 * Rolls up at the *target's* level rather than the map's. Those differ by
 * design: clicking a province zooms the map to districts while its panel stays
 * open, so reading the active level here would total the wrong thing — or
 * nothing at all, since a province code does not appear in a district rollup.
 */
export function useRegionDetail(
  index: CrimeIndex,
  categories: readonly CrimeCategory[],
  filters: FilterSet,
  detail: DetailTarget | null,
): RegionDetailData | null {
  const code = detail?.code ?? null;
  const level = detail?.level ?? null;

  return useMemo(() => {
    if (code === null || level === null) return null;

    const rolled = rollup(index, level, filters);
    const aggregate = rolled.byRegion.get(code);
    const name = getLevelRegionMeta(level).get(code)?.name ?? code;
    // Only a province has districts under it, and only then is the second
    // pass over the records worth paying for.
    const children = level === 'il' ? rankChildren(index, filters, code) : [];
    const byYear = totalsByYear(index, {
      categories: filters.categories,
      region: { level, code },
    });

    // A region the consumer's data never mentions still deserves a panel: it
    // was opened on purpose, and "0" answers the question that was asked.
    if (aggregate === undefined) {
      return { code, level, name, total: 0, categories: [], byYear, children };
    }

    const labels = new Map(categories.map((category) => [category.id, category.label]));
    const breakdown: DetailCategory[] = [...aggregate.byCategory.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => ({
        id,
        label: labels.get(id) ?? id,
        value,
        share: aggregate.total === 0 ? 0 : value / aggregate.total,
      }));

    return {
      code,
      level,
      name,
      total: aggregate.total,
      categories: breakdown,
      byYear,
      children,
    };
  }, [index, categories, filters, code, level]);
}
