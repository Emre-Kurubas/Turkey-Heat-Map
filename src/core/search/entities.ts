import type { CrimeCategory, RegionMeta } from '@/core/types/index.js';
import { foldTurkish } from './normalize.js';

export type SearchEntityType = 'il' | 'ilce' | 'category' | 'year';

export interface SearchEntity {
  readonly type: SearchEntityType;
  readonly id: string;
  readonly label: string;
  /** Precomputed foldTurkish(label). */
  readonly folded: string;
  /** Parent province name for an ilçe; null for every other type. */
  readonly parentLabel: string | null;
}

export interface SearchIndexInput {
  ilRegions: readonly RegionMeta[];
  ilceRegions: readonly RegionMeta[];
  categories: readonly CrimeCategory[];
  years: readonly number[];
  /** il code → name, for resolving ilçe parents. */
  ilNames: ReadonlyMap<string, string>;
}

/**
 * Builds the flat entity list the search bar matches against.
 *
 * Folding is done once here rather than per keystroke. With roughly 1,070
 * entities and a keystroke budget in single-digit milliseconds, re-folding on
 * every input event would dominate the cost of searching.
 */
export function buildSearchIndex(input: SearchIndexInput): SearchEntity[] {
  const { ilRegions, ilceRegions, categories, years, ilNames } = input;
  const entities: SearchEntity[] = [];

  for (const il of ilRegions) {
    entities.push({
      type: 'il', id: il.code, label: il.name,
      folded: foldTurkish(il.name), parentLabel: null,
    });
  }

  for (const ilce of ilceRegions) {
    // The dropdown renders "Şişli · İstanbul". Two provinces can hold districts
    // with the same name, so the parent label is what tells them apart.
    const parentLabel = ilce.parentCode === null
      ? null
      : ilNames.get(ilce.parentCode) ?? ilce.parentCode;

    entities.push({
      type: 'ilce', id: ilce.code, label: ilce.name,
      folded: foldTurkish(ilce.name), parentLabel,
    });
  }

  for (const category of categories) {
    entities.push({
      type: 'category', id: category.id, label: category.label,
      folded: foldTurkish(category.label), parentLabel: null,
    });
  }

  for (const year of years) {
    const label = String(year);
    entities.push({ type: 'year', id: label, label, folded: label, parentLabel: null });
  }

  return entities;
}
