import { ilCodeFromIlceCode, isValidIlCode } from '@/data/geo/region-meta.js';
import type {
  CrimeCategory, CrimeRecord, DataWarning, DataWarningCode, NormalizedRecord,
} from '@/core/types/index.js';

export interface CrimeIndex {
  readonly records: readonly NormalizedRecord[];
  readonly years: readonly number[];
  readonly categories: readonly string[];
  readonly ilCodes: readonly string[];
  readonly ilceCodes: readonly string[];
  readonly hasIlceData: boolean;
  readonly warnings: readonly DataWarning[];
}

export interface BuildIndexOptions {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  /** When supplied, ilçe codes are checked against this set as well as structurally. */
  knownIlceCodes?: ReadonlySet<string>;
}

const MAX_SAMPLES = 5;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

const WARNING_MESSAGES: Readonly<Record<DataWarningCode, string>> = {
  'unknown-il': 'Tanınmayan il kodu içeren kayıtlar yok sayıldı.',
  'unknown-ilce': 'Tanınmayan veya geçersiz ilçe kodu içeren kayıtlar yok sayıldı.',
  'ilce-parent-mismatch': 'İlçe kodu, bağlı olduğu il koduyla uyuşmayan kayıtlar yok sayıldı.',
  'unknown-category': 'Tanımlı olmayan suç kategorisine ait kayıtlar yok sayıldı.',
  'invalid-count':
    'Geçersiz suç sayısı içeren kayıtlar yok sayıldı (negatif, ondalıklı veya sayı değil).',
  'invalid-year': 'Geçersiz yıl içeren kayıtlar yok sayıldı.',
  'duplicate-key': 'Aynı yıl, bölge ve kategoriye ait yinelenen kayıtlar toplandı.',
  'empty-dataset': 'Geçerli hiçbir kayıt bulunamadı. Harita boş görüntülenecek.',
};

/** Accumulates warnings by code so the UI shows one entry per problem, not per row. */
class WarningCollector {
  private readonly counts = new Map<DataWarningCode, { count: number; samples: string[] }>();

  add(code: DataWarningCode, sample: string): void {
    const existing = this.counts.get(code);
    if (existing === undefined) {
      this.counts.set(code, { count: 1, samples: [sample] });
      return;
    }
    existing.count += 1;
    if (existing.samples.length < MAX_SAMPLES) existing.samples.push(sample);
  }

  toArray(): DataWarning[] {
    return [...this.counts].map(([code, { count, samples }]) => ({
      code, count, samples, message: WARNING_MESSAGES[code],
    }));
  }
}

/**
 * Validates and normalizes raw consumer records.
 *
 * Never throws. Bad rows are dropped and summarized as warnings, because a
 * library that crashes a host page over one malformed row is unacceptable.
 */
export function buildIndex(options: BuildIndexOptions): CrimeIndex {
  const { data, categories, knownIlceCodes } = options;

  const warnings = new WarningCollector();
  const categoryIds = categories.map((category) => category.id);
  const validCategories = new Set(categoryIds);

  // Composite key → merged record. Insertion order gives deterministic output.
  const merged = new Map<string, NormalizedRecord>();

  for (const raw of data) {
    if (!Number.isInteger(raw.year) || raw.year < MIN_YEAR || raw.year > MAX_YEAR) {
      warnings.add('invalid-year', String(raw.year));
      continue;
    }
    if (!isValidIlCode(raw.ilCode)) {
      warnings.add('unknown-il', String(raw.ilCode));
      continue;
    }

    let ilceCode: string | null = null;
    if (raw.ilceCode !== undefined) {
      const parent = ilCodeFromIlceCode(raw.ilceCode);
      if (parent === null) {
        warnings.add('unknown-ilce', raw.ilceCode);
        continue;
      }
      if (parent !== raw.ilCode) {
        warnings.add('ilce-parent-mismatch', `${raw.ilceCode} → ${raw.ilCode}`);
        continue;
      }
      if (knownIlceCodes !== undefined && !knownIlceCodes.has(raw.ilceCode)) {
        warnings.add('unknown-ilce', raw.ilceCode);
        continue;
      }
      ilceCode = raw.ilceCode;
    }

    if (!validCategories.has(raw.category)) {
      warnings.add('unknown-category', String(raw.category));
      continue;
    }
    // Zero is meaningful — "no crimes recorded" is data, not absence of data.
    if (!Number.isInteger(raw.count) || raw.count < 0) {
      warnings.add('invalid-count', String(raw.count));
      continue;
    }

    const key = `${raw.year}|${raw.ilCode}|${ilceCode ?? ''}|${raw.category}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        year: raw.year, ilCode: raw.ilCode, ilceCode,
        category: raw.category, count: raw.count,
      });
    } else {
      existing.count += raw.count;
      warnings.add('duplicate-key', key);
    }
  }

  const records = [...merged.values()];

  const years = new Set<number>();
  const ilCodes = new Set<string>();
  const ilceCodes = new Set<string>();
  for (const rec of records) {
    years.add(rec.year);
    ilCodes.add(rec.ilCode);
    if (rec.ilceCode !== null) ilceCodes.add(rec.ilceCode);
  }

  if (records.length === 0) {
    warnings.add('empty-dataset', '0');
  }

  return {
    records,
    years: [...years].sort((a, b) => a - b),
    categories: categoryIds,
    ilCodes: [...ilCodes].sort(),
    ilceCodes: [...ilceCodes].sort(),
    hasIlceData: ilceCodes.size > 0,
    warnings: warnings.toArray(),
  };
}
