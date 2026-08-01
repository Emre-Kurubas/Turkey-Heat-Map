import { useMemo } from 'react';
import type { DetailTarget } from '@/context/HeatMapStore.js';
import { rollup, type CrimeIndex } from '@/core/aggregation/index.js';
import type { CrimeCategory, FilterSet, GeoLevel } from '@/core/types/index.js';
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
  byYear: ReadonlyMap<number, number>;
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

    // A region the consumer's data never mentions still deserves a panel: it
    // was opened on purpose, and "0" answers the question that was asked.
    if (aggregate === undefined) {
      return { code, level, name, total: 0, categories: [], byYear: new Map() };
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
      byYear: aggregate.byYear,
    };
  }, [index, categories, filters, code, level]);
}
