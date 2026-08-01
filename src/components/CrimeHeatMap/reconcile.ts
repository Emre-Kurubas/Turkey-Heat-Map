import type { CrimeIndex } from '@/core/aggregation/index.js';
import type {
  FilterSet, GeoLevel, MetricMode, RegionPopulation,
} from '@/core/types/index.js';

/**
 * Fields accept explicit `undefined` as well as omission, so a caller can
 * forward its own optional props straight through under
 * `exactOptionalPropertyTypes`.
 */
export interface ReconcileInput {
  defaultFilters?: {
    yearRange?: [number, number] | undefined;
    categories?: readonly string[] | undefined;
  } | undefined;
  defaultView?: { level?: GeoLevel | undefined; focusedIl?: string | null | undefined } | undefined;
  metric?: MetricMode | undefined;
  population?: readonly RegionPopulation[] | undefined;
}

export interface ReconcileResult {
  filters: FilterSet;
  /** The data's full year span, independent of the requested filter range. */
  yearBounds: [number, number];
  level: GeoLevel;
  metric: MetricMode;
  /** Turkish messages for onDataWarning and the debug overlay. */
  warnings: string[];
}

/** Fallback span when the dataset carries no usable years at all. */
const FALLBACK_YEAR = 2024;

/**
 * Applies the prop reconciliation rules from §8.
 *
 * Every rule resolves to a defined behaviour and a warning rather than an
 * exception: a consumer passing a stale year range should get a usable map and
 * a diagnostic, not a blank component.
 */
export function reconcileProps(input: ReconcileInput, index: CrimeIndex): ReconcileResult {
  const warnings: string[] = [];

  const years = index.years;
  const dataMin = years[0] ?? FALLBACK_YEAR;
  const dataMax = years[years.length - 1] ?? FALLBACK_YEAR;

  // --- Year range ---
  const requested = input.defaultFilters?.yearRange;
  let yearRange: [number, number] = [dataMin, dataMax];

  if (requested !== undefined) {
    const start = Math.min(requested[0], requested[1]);
    const end = Math.max(requested[0], requested[1]);

    if (end < dataMin || start > dataMax) {
      warnings.push('İstenen yıl aralığı veriyle örtüşmüyor; tam aralığa dönüldü.');
    } else {
      yearRange = [Math.max(start, dataMin), Math.min(end, dataMax)];
    }
  }

  // --- Categories ---
  const knownCategories = new Set(index.categories);
  const requestedCategories = input.defaultFilters?.categories ?? [];
  const categories = requestedCategories.filter((id) => knownCategories.has(id));
  if (categories.length !== requestedCategories.length) {
    warnings.push('Tanınmayan kategori seçimleri yok sayıldı.');
  }

  // --- Metric ---
  let metric: MetricMode = input.metric ?? 'total';
  if (metric === 'perCapita' && (input.population === undefined || input.population.length === 0)) {
    warnings.push('Nüfus verisi olmadan kişi başı ölçüm yapılamaz; toplama dönüldü.');
    metric = 'total';
  }

  // --- Level ---
  let level: GeoLevel = input.defaultView?.level ?? 'il';
  if (level === 'ilce' && !index.hasIlceData) {
    warnings.push('Veride ilçe kodu yok; il düzeyine dönüldü.');
    level = 'il';
  }

  return {
    filters: { yearRange, categories },
    yearBounds: [dataMin, dataMax],
    level,
    metric,
    warnings,
  };
}
