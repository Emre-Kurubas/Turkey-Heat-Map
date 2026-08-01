import { trStrings } from './tr.js';
import type { PartialStrings, Strings } from './types.js';

export type { PartialStrings, Strings } from './types.js';
export { trStrings } from './tr.js';

/**
 * Merges one group of overrides over its defaults.
 *
 * An explicit `undefined` is treated as "not provided" rather than "erase this
 * string", because a partial object built from optional props would otherwise
 * blank out defaults wherever the consumer left a prop unset.
 */
function mergeGroup<K extends keyof Strings>(
  key: K,
  overrides: PartialStrings,
): Strings[K] {
  const group = overrides[key];
  if (group === undefined) return trStrings[key];

  const defined = Object.fromEntries(
    Object.entries(group).filter(([, value]) => value !== undefined),
  ) as Partial<Strings[K]>;

  return { ...trStrings[key], ...defined };
}

/**
 * Merges consumer overrides over the Turkish defaults, one level deep.
 *
 * One level is deliberate: the table is exactly two levels deep, so a shallow
 * per-group merge is total. The groups are listed explicitly rather than looped
 * over, because a loop erases the correlation between the key and its value
 * type — this way adding a group to `Strings` is a compile error here until it
 * is handled.
 */
export function mergeStrings(overrides?: PartialStrings): Strings {
  if (overrides === undefined) return trStrings;

  return {
    map: mergeGroup('map', overrides),
    level: mergeGroup('level', overrides),
    legend: mergeGroup('legend', overrides),
    filters: mergeGroup('filters', overrides),
    detail: mergeGroup('detail', overrides),
    pie: mergeGroup('pie', overrides),
    trend: mergeGroup('trend', overrides),
    sidebar: mergeGroup('sidebar', overrides),
    search: mergeGroup('search', overrides),
    scaleMode: mergeGroup('scaleMode', overrides),
    tooltip: mergeGroup('tooltip', overrides),
    attribution: mergeGroup('attribution', overrides),
    error: mergeGroup('error', overrides),
  };
}
