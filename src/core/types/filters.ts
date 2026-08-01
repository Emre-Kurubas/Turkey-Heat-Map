export type GeoLevel = 'il' | 'ilce';

export interface FilterSet {
  /** Inclusive [start, end]. Always start <= end. */
  yearRange: [number, number];
  /** Empty array means "all categories", not "no categories". */
  categories: readonly string[];
}

export type MetricMode = 'total' | 'perCapita';
