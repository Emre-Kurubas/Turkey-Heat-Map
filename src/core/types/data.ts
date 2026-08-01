/** A single pre-aggregated crime count. This is the library's input unit. */
export interface CrimeRecord {
  /** Calendar year, e.g. 2023. */
  year: number;
  /** Official plaka code, zero-padded to 2 digits: "01".."81". */
  ilCode: string;
  /** TÜİK district code, 4 digits, first two match ilCode. Omit for il-only datasets. */
  ilceCode?: string;
  /** Must match a CrimeCategory.id. */
  category: string;
  /** Non-negative integer. */
  count: number;
}

export interface CrimeCategory {
  id: string;
  /** Turkish display label, e.g. "Hırsızlık". */
  label: string;
  /** Optional pie-chart color override; otherwise assigned from the palette. */
  color?: string;
}

export interface RegionPopulation {
  ilCode: string;
  ilceCode?: string;
  year: number;
  population: number;
}

/** Static geography metadata, independent of any dataset. */
export interface RegionMeta {
  code: string;
  name: string;
  /** Present for ilçe, null for il. */
  parentCode: string | null;
}

export type DataWarningCode =
  | 'unknown-il'
  | 'unknown-ilce'
  | 'ilce-parent-mismatch'
  | 'unknown-category'
  | 'invalid-count'
  | 'invalid-year'
  | 'duplicate-key'
  | 'empty-dataset';

export interface DataWarning {
  code: DataWarningCode;
  /** Turkish, human-readable, safe to surface in the debug overlay. */
  message: string;
  /** How many records triggered this warning. */
  count: number;
  /** Up to 5 example values, for debugging. */
  samples: string[];
}

/** A validated record. `ilceCode` is normalized to null rather than undefined. */
export interface NormalizedRecord {
  year: number;
  ilCode: string;
  ilceCode: string | null;
  category: string;
  count: number;
}
