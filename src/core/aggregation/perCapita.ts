import type { GeoLevel, RegionPopulation } from '@/core/types/index.js';
import type { RegionAggregate, RollupResult } from './rollup.js';

export type PopulationIndex = ReadonlyMap<string, number>;

/** Crimes per this many residents. The convention for published crime rates. */
const DEFAULT_PER = 100_000;

/**
 * Population per region for the filtered years.
 *
 * Averaged across the range, not summed. Summing would make a ten-year filter
 * report a province as ten times as populous and drive every rate to a tenth of
 * its true value — a bug that looks like plausible data.
 */
export function buildPopulationIndex(
  population: readonly RegionPopulation[],
  level: GeoLevel,
  yearRange: readonly [number, number],
): PopulationIndex {
  const [start, end] = yearRange;
  const sums = new Map<string, { total: number; count: number }>();

  for (const row of population) {
    if (row.year < start || row.year > end) continue;

    // At district level an il-only row has no district to attribute to. Keying
    // it by its province would silently give every district in that province
    // the whole provincial population.
    const code = level === 'ilce' ? row.ilceCode : row.ilCode;
    if (code === undefined) continue;

    const entry = sums.get(code) ?? { total: 0, count: 0 };
    entry.total += row.population;
    entry.count += 1;
    sums.set(code, entry);
  }

  const out = new Map<string, number>();
  for (const [code, { total, count }] of sums) out.set(code, total / count);
  return out;
}

/**
 * Restates a rollup as a rate per `per` residents.
 *
 * A region with no population is dropped rather than rendered as zero: "no
 * population figure" and "nobody lives here" are different claims, and a zero
 * would paint the region at the bottom of the scale as though it were safe.
 */
export function toPerCapita(
  result: RollupResult,
  populations: PopulationIndex,
  per: number = DEFAULT_PER,
): RollupResult {
  const byRegion = new Map<string, RegionAggregate>();
  const values: number[] = [];

  for (const [code, aggregate] of result.byRegion) {
    const population = populations.get(code);
    if (population === undefined || population <= 0) continue;

    const factor = per / population;
    const byCategory = new Map<string, number>();
    for (const [id, count] of aggregate.byCategory) byCategory.set(id, count * factor);

    const byYear = new Map<number, number>();
    for (const [year, count] of aggregate.byYear) byYear.set(year, count * factor);

    const total = aggregate.total * factor;
    byRegion.set(code, { code, total, byCategory, byYear });
    values.push(total);
  }

  return {
    level: result.level,
    byRegion,
    total: result.total,
    byCategory: result.byCategory,
    byYear: result.byYear,
    values,
  };
}
