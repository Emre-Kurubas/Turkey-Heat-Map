import type { CrimeCategory, CrimeRecord, RegionPopulation } from '@/core/types/index.js';
import { IL_REGIONS } from '@/data/geo/region-meta.js';
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
  /** Synthetic ilçe code → name, matching the generated records. */
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
 * District count scales with province size, so İstanbul gets more than Bayburt.
 *
 * Tier sizes are chosen so the totals land at 972 districts across the 81
 * provinces — within one of Turkey's real 973 — which keeps the generated
 * dataset at genuine production scale for the performance guards.
 */
function districtCount(weight: number): number {
  if (weight >= 40) return 32;
  if (weight >= 15) return 20;
  if (weight >= 8) return 14;
  return 10;
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
    const districts = districtCount(weight);

    // A per-province multiplier so provinces of similar size still differ.
    const ilFactor = 0.7 + random() * 0.6;

    const codes: string[] = [];
    for (let d = 1; d <= districts; d += 1) {
      const ilceCode = `${il.code}${String(d).padStart(2, '0')}`;
      codes.push(ilceCode);
      ilceNames.set(ilceCode, `${il.name} ${d}. Bölge`);
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
            const count = Math.max(0, Math.round((base / districts) * share));
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
