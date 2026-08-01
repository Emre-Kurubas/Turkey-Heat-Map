import type { FilterSet, GeoLevel } from '@/core/types/index.js';
import type { CrimeIndex } from './buildIndex.js';

export interface RegionAggregate {
  readonly code: string;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
}

export interface RollupResult {
  readonly level: GeoLevel;
  readonly byRegion: ReadonlyMap<string, RegionAggregate>;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
  /** Region totals, ready to hand to createColorDomain. */
  readonly values: readonly number[];
}

interface MutableAggregate {
  code: string;
  total: number;
  byCategory: Map<string, number>;
  byYear: Map<number, number>;
}

function bump<K>(map: Map<K, number>, key: K, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * Computes per-region totals for the given filters, in a single pass.
 *
 * Regions with no matching records are omitted entirely rather than emitted with
 * a zero. "No data" and "measured zero" are different facts, and rendering the
 * first as the second would paint unmeasured provinces as the safest in the
 * country.
 */
export function rollup(
  index: CrimeIndex,
  level: GeoLevel,
  filters: FilterSet,
): RollupResult {
  const [startYear, endYear] = filters.yearRange;
  // Empty category list means "all categories" (see FilterSet in core/types).
  const categoryFilter = filters.categories.length === 0
    ? null
    : new Set(filters.categories);

  const regions = new Map<string, MutableAggregate>();
  const byCategory = new Map<string, number>();
  const byYear = new Map<number, number>();
  let total = 0;

  /*
   * Whole years are skipped, not filtered row by row.
   *
   * `index.byYear` groups the records once at build time, so a range covering
   * three years of ten never touches the other seven — the work follows the
   * size of the selection rather than the size of the dataset. The per-record
   * year comparison disappears with it.
   */
  for (const [year, bucket] of index.byYear) {
    if (year < startYear || year > endYear) continue;

    for (const rec of bucket) {
      if (categoryFilter !== null && !categoryFilter.has(rec.category)) continue;

      const code = level === 'il' ? rec.ilCode : rec.ilceCode;
      if (code === null) continue; // ilçe level, il-only record

      let aggregate = regions.get(code);
      if (aggregate === undefined) {
        aggregate = { code, total: 0, byCategory: new Map(), byYear: new Map() };
        regions.set(code, aggregate);
      }

      aggregate.total += rec.count;
      bump(aggregate.byCategory, rec.category, rec.count);
      bump(aggregate.byYear, year, rec.count);

      bump(byCategory, rec.category, rec.count);
      bump(byYear, year, rec.count);
      total += rec.count;
    }
  }

  const values: number[] = [];
  for (const aggregate of regions.values()) values.push(aggregate.total);

  return { level, byRegion: regions, total, byCategory, byYear, values };
}
