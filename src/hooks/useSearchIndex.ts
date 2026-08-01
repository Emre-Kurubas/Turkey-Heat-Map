import { useMemo } from 'react';
import { buildSearchIndex, type SearchEntity } from '@/core/search/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { IL_REGIONS } from '@/core/geo/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';

/**
 * The flat entity list the search bar matches against.
 *
 * Built from the shipped geography rather than the dataset, so a province with
 * no records is still findable — searching for a place and being told it does
 * not exist is a worse answer than finding it and seeing zero.
 */
export function useSearchIndex(
  categories: readonly CrimeCategory[],
  years: readonly number[],
): SearchEntity[] {
  return useMemo(() => {
    const ilNames = new Map(IL_REGIONS.map((region) => [region.code, region.name]));
    return buildSearchIndex({
      ilRegions: IL_REGIONS,
      ilceRegions: [...getLevelRegionMeta('ilce').values()],
      categories,
      years,
      ilNames,
    });
  }, [categories, years]);
}
