import { compareTurkish } from '@/core/search/collate.js';
import type { RollupResult } from './rollup.js';

export type RankSort = 'total-desc' | 'total-asc' | 'name-asc' | 'name-desc';

export interface RankOptions {
  sort: RankSort;
  /** Region code → display name. Missing codes fall back to the code itself. */
  names: ReadonlyMap<string, string>;
}

export interface RankedRegion {
  code: string;
  name: string;
  total: number;
  /** Fraction of the rollup total, 0..1. Zero when the total is zero. */
  share: number;
  /** 1-based position by total. Independent of the active sort. */
  rank: number;
}

/**
 * Orders regions for the sidebar.
 *
 * `rank` is always computed from the total, never from the active sort, so the
 * position badge next to a province stays "3." whether the list is sorted by
 * count or alphabetically. Ties break alphabetically so the order is stable
 * across renders rather than depending on Map insertion order.
 */
export function rankRegions(result: RollupResult, options: RankOptions): RankedRegion[] {
  const { names, sort } = options;

  const rows: RankedRegion[] = [...result.byRegion.values()].map((aggregate) => ({
    code: aggregate.code,
    name: names.get(aggregate.code) ?? aggregate.code,
    total: aggregate.total,
    share: result.total === 0 ? 0 : aggregate.total / result.total,
    rank: 0,
  }));

  // Assign ranks from the total ordering first, before applying the display sort.
  const byTotal = [...rows].sort(
    (a, b) => b.total - a.total || compareTurkish(a.name, b.name),
  );
  byTotal.forEach((row, index) => { row.rank = index + 1; });

  switch (sort) {
    case 'total-desc':
      return byTotal;
    case 'total-asc':
      return [...byTotal].reverse();
    case 'name-asc':
      return [...rows].sort((a, b) => compareTurkish(a.name, b.name));
    case 'name-desc':
      return [...rows].sort((a, b) => compareTurkish(b.name, a.name));
  }
}
