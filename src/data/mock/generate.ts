import type { CrimeCategory, CrimeRecord, RegionPopulation } from '@/core/types/index.js';
import { IL_REGIONS } from '@/data/geo/region-meta.js';
// Imported from the module, not the barrel: the barrel re-exports region-meta
// too, and going through it would make data/geo and data/mock mutually
// reachable at load time.
import { getLevelRegionMeta } from '@/data/geo/topology.js';
import { MOCK_CATEGORIES } from './categories.js';
import { createPrng } from './prng.js';

export interface MockDataOptions {
  seed?: number;
  years?: readonly number[];
  includeIlce?: boolean;
  includePopulation?: boolean;
}

export interface MockDataset {
  records: CrimeRecord[];
  categories: CrimeCategory[];
  population: RegionPopulation[];
  /** Ilçe code → name, taken from the shipped geography. */
  ilceNames: Map<string, string>;
}

const DEFAULT_SEED = 20_260_801;
const DEFAULT_YEARS: readonly number[] = [
  2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
];

/**
 * Relative population weight per province, used to skew crime counts.
 * Real crime data is dominated by a handful of metropolitan provinces, and the
 * mock data must reproduce that skew — it is precisely the property that makes
 * quantile color scaling necessary rather than optional.
 */
const IL_WEIGHTS: Readonly<Record<string, number>> = {
  '34': 100, '06': 42, '35': 33, '16': 24, '07': 21, '01': 17, '42': 16,
  '41': 15, '27': 15, '61': 12, '31': 12, '33': 12, '38': 11, '21': 11,
  '45': 11, '55': 10, '63': 10, '20': 9, '10': 9, '44': 8, '65': 8,
};
const DEFAULT_WEIGHT = 4;

/**
 * Districts come from the shipped geography rather than a synthetic count.
 *
 * An invented count only overlapped the real `{plaka}{sıra}` codes by accident:
 * a province with more real districts than mock ones left a no-data tail on the
 * map, and one with fewer produced records for regions that cannot be drawn.
 * Reading the real division fixes both, and keeps the dataset at genuine
 * production scale (973 districts) for the performance guards.
 *
 * Magnitudes are still shaped by IL_WEIGHTS below — only the administrative
 * division comes from the geography.
 */
function districtsOf(ilCode: string): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (const [code, meta] of getLevelRegionMeta('ilce')) {
    if (meta.parentCode === ilCode) out.push({ code, name: meta.name });
  }
  return out;
}

/**
 * Builds a deterministic, realistic-shaped demo dataset.
 *
 * DEMO DATA ONLY. The numbers are synthetic and describe nothing real. They
 * exist to drive the playground, the test suite, and the documentation.
 */
export function generateMockData(options: MockDataOptions = {}): MockDataset {
  const {
    seed = DEFAULT_SEED,
    years = DEFAULT_YEARS,
    includeIlce = true,
    includePopulation = true,
  } = options;

  const random = createPrng(seed);
  const records: CrimeRecord[] = [];
  const population: RegionPopulation[] = [];
  const ilceNames = new Map<string, string>();

  for (const il of IL_REGIONS) {
    const weight = IL_WEIGHTS[il.code] ?? DEFAULT_WEIGHT;

    // A per-province multiplier so provinces of similar size still differ.
    const ilFactor = 0.7 + random() * 0.6;

    const codes: string[] = [];
    for (const district of districtsOf(il.code)) {
      codes.push(district.code);
      ilceNames.set(district.code, district.name);
    }

    for (const [yearIndex, year] of years.entries()) {
      // A gentle national trend plus per-province noise, so the trend chart has
      // something to show rather than a flat line.
      const trend = 1 + yearIndex * 0.03 + (random() - 0.5) * 0.1;

      if (includePopulation) {
        population.push({
          ilCode: il.code,
          year,
          population: Math.round(weight * 85_000 * ilFactor * (1 + yearIndex * 0.01)),
        });
      }

      for (const category of MOCK_CATEGORIES) {
        const categoryFactor = 0.4 + random() * 1.2;
        const base = weight * ilFactor * trend * categoryFactor * 6;

        if (includeIlce) {
          for (const ilceCode of codes) {
            const share = 0.4 + random() * 1.2;
            const count = Math.max(0, Math.round((base / codes.length) * share));
            records.push({ year, ilCode: il.code, ilceCode, category: category.id, count });
          }
        } else {
          records.push({
            year, ilCode: il.code, category: category.id,
            count: Math.max(0, Math.round(base)),
          });
        }
      }
    }
  }

  return {
    records,
    categories: [...MOCK_CATEGORIES],
    population: includePopulation ? population : [],
    ilceNames,
  };
}
