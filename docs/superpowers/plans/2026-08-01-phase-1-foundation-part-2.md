# Türkiye Suç Haritası — Phase 1 Foundation, Part 2 (Tasks 10–23)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-08-01-phase-1-foundation.md` first.** It contains the Goal, Architecture, Global Constraints, and Tasks 1–9. This document continues from Task 10 and assumes Tasks 1–9 are complete and committed.

**Global Constraints:** see Part 1. They apply unchanged to every task here — most importantly: `core/` stays React-free and DOM-free, invalid data never throws, no `Math.random()`, no `toLowerCase()` for Turkish, and 100% branch coverage on `core/`.

---

## Task 10: Aggregation index

The entry point for all consumer data. Everything downstream reads a `CrimeIndex`, never raw `CrimeRecord[]`.

**Files:**
- Create: `src/core/aggregation/buildIndex.ts`
- Test: `src/core/aggregation/buildIndex.test.ts`

**Interfaces:**
- Consumes: `CrimeRecord`, `CrimeCategory`, `NormalizedRecord`, `DataWarning`, `DataWarningCode` from `@/core/types`; `isValidIlCode`, `ilCodeFromIlceCode` from `@/data/geo/region-meta.js`
- Produces:

```ts
interface CrimeIndex {
  readonly records: readonly NormalizedRecord[];
  readonly years: readonly number[];        // ascending, unique
  readonly categories: readonly string[];   // ids, in the order supplied
  readonly ilCodes: readonly string[];      // present in data, ascending
  readonly ilceCodes: readonly string[];    // present in data, ascending
  readonly hasIlceData: boolean;
  readonly warnings: readonly DataWarning[];
}
interface BuildIndexOptions {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  /** When supplied, ilçe codes are checked against this set as well as structurally. */
  knownIlceCodes?: ReadonlySet<string>;
}
function buildIndex(options: BuildIndexOptions): CrimeIndex;
```

- [x] **Step 1: Write the failing tests**

Create `src/core/aggregation/buildIndex.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

function record(over: Partial<CrimeRecord> = {}): CrimeRecord {
  return { year: 2023, ilCode: '34', category: 'hirsizlik', count: 10, ...over };
}

describe('buildIndex — valid data', () => {
  it('normalizes a minimal il-level dataset', () => {
    const index = buildIndex({ data: [record()], categories: CATEGORIES });

    expect(index.records).toEqual([
      { year: 2023, ilCode: '34', ilceCode: null, category: 'hirsizlik', count: 10 },
    ]);
    expect(index.years).toEqual([2023]);
    expect(index.ilCodes).toEqual(['34']);
    expect(index.hasIlceData).toBe(false);
    expect(index.warnings).toEqual([]);
  });

  it('detects ilçe data and collects ilçe codes', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3402' })],
      categories: CATEGORIES,
    });

    expect(index.hasIlceData).toBe(true);
    expect(index.ilceCodes).toEqual(['3401', '3402']);
  });

  it('returns years ascending and deduplicated', () => {
    const index = buildIndex({
      data: [record({ year: 2023 }), record({ year: 2019 }), record({ year: 2023, count: 5 })],
      categories: CATEGORIES,
    });
    expect(index.years).toEqual([2019, 2023]);
  });

  it('preserves the supplied category order', () => {
    const index = buildIndex({ data: [record()], categories: CATEGORIES });
    expect(index.categories).toEqual(['hirsizlik', 'darp']);
  });

  it('sorts il and ilçe codes ascending regardless of input order', () => {
    const index = buildIndex({
      data: [
        record({ ilCode: '34', ilceCode: '3402' }),
        record({ ilCode: '06', ilceCode: '0601' }),
      ],
      categories: CATEGORIES,
    });
    expect(index.ilCodes).toEqual(['06', '34']);
    expect(index.ilceCodes).toEqual(['0601', '3402']);
  });
});

describe('buildIndex — invalid data is dropped, never thrown', () => {
  it('drops records with an unknown il code', () => {
    const index = buildIndex({
      data: [record(), record({ ilCode: '99' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    const warning = index.warnings.find((w) => w.code === 'unknown-il');
    expect(warning?.count).toBe(1);
    expect(warning?.samples).toContain('99');
  });

  it('drops records whose ilçe code is structurally malformed', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '340' }), record({ ilceCode: 'abcd' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'unknown-ilce')?.count).toBe(2);
  });

  it('drops records whose ilçe code contradicts its il code', () => {
    // 3401 belongs to İstanbul (34), not Ankara (06). Silently trusting either
    // field would put crimes in the wrong province.
    const index = buildIndex({
      data: [record({ ilCode: '06', ilceCode: '3401' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'ilce-parent-mismatch')?.count).toBe(1);
  });

  it('drops ilçe codes absent from a supplied known-code set', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3499' })],
      categories: CATEGORIES,
      knownIlceCodes: new Set(['3401']),
    });

    expect(index.records).toHaveLength(1);
    expect(index.warnings.find((w) => w.code === 'unknown-ilce')?.samples).toContain('3499');
  });

  it('drops records with an unknown category', () => {
    const index = buildIndex({
      data: [record(), record({ category: 'yok' })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    expect(index.warnings.find((w) => w.code === 'unknown-category')?.samples).toContain('yok');
  });

  it('drops negative, fractional and non-numeric counts', () => {
    const index = buildIndex({
      data: [
        record({ count: -5 }),
        record({ count: 1.5 }),
        record({ count: Number.NaN }),
        record({ count: Number.POSITIVE_INFINITY }),
      ],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'invalid-count')?.count).toBe(4);
  });

  it('keeps a zero count, which is meaningful data', () => {
    const index = buildIndex({ data: [record({ count: 0 })], categories: CATEGORIES });
    expect(index.records).toHaveLength(1);
    expect(index.warnings).toEqual([]);
  });

  it('drops records with a non-integer or out-of-range year', () => {
    const index = buildIndex({
      data: [record({ year: 20.5 }), record({ year: 1200 }), record({ year: 3000 })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(0);
    expect(index.warnings.find((w) => w.code === 'invalid-year')?.count).toBe(3);
  });

  it('sums duplicate keys and warns', () => {
    const index = buildIndex({
      data: [record({ count: 10 }), record({ count: 5 })],
      categories: CATEGORIES,
    });

    expect(index.records).toHaveLength(1);
    expect(index.records[0]!.count).toBe(15);
    expect(index.warnings.find((w) => w.code === 'duplicate-key')?.count).toBe(1);
  });

  it('does not merge records that differ only by ilçe', () => {
    const index = buildIndex({
      data: [record({ ilceCode: '3401' }), record({ ilceCode: '3402' })],
      categories: CATEGORIES,
    });
    expect(index.records).toHaveLength(2);
  });

  it('caps warning samples at five', () => {
    const data = Array.from({ length: 20 }, (_, i) =>
      record({ ilCode: '99', category: `bilinmeyen-${i}` }));
    const index = buildIndex({ data, categories: CATEGORIES });

    const warning = index.warnings.find((w) => w.code === 'unknown-il');
    expect(warning?.count).toBe(20);
    expect(warning?.samples).toHaveLength(5);
  });

  it('writes warning messages in Turkish', () => {
    const index = buildIndex({ data: [record({ ilCode: '99' })], categories: CATEGORIES });
    expect(index.warnings[0]!.message).toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
  });

  it('never throws on wholly malformed input', () => {
    expect(() => buildIndex({
      data: [record({ ilCode: '99', ilceCode: 'zz', category: 'x', count: -1, year: 0 })],
      categories: CATEGORIES,
    })).not.toThrow();
  });
});

describe('buildIndex — empty inputs', () => {
  it('warns about an empty dataset', () => {
    const index = buildIndex({ data: [], categories: CATEGORIES });

    expect(index.records).toEqual([]);
    expect(index.years).toEqual([]);
    expect(index.hasIlceData).toBe(false);
    expect(index.warnings.find((w) => w.code === 'empty-dataset')).toBeDefined();
  });

  it('warns when every record is dropped', () => {
    const index = buildIndex({ data: [record({ ilCode: '99' })], categories: CATEGORIES });
    expect(index.warnings.find((w) => w.code === 'empty-dataset')).toBeDefined();
  });

  it('drops everything when no categories are supplied', () => {
    const index = buildIndex({ data: [record()], categories: [] });
    expect(index.records).toEqual([]);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/aggregation`
Expected: FAIL — cannot resolve `./buildIndex.js`.

- [x] **Step 3: Implement `src/core/aggregation/buildIndex.ts`**

```ts
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
  'invalid-count': 'Geçersiz suç sayısı içeren kayıtlar yok sayıldı (negatif, ondalıklı veya sayı değil).',
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
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/aggregation`
Expected: PASS, all tests green.

- [x] **Step 5: Commit**

```bash
git add src/core/aggregation/buildIndex.ts src/core/aggregation/buildIndex.test.ts
git commit -m "feat(core): add crime record validation and index building"
```

---

## Task 11: Rollup

**Files:**
- Create: `src/core/aggregation/rollup.ts`
- Test: `src/core/aggregation/rollup.test.ts`

**Interfaces:**
- Consumes: `CrimeIndex` (Task 10), `FilterSet`, `GeoLevel`
- Produces:

```ts
interface RegionAggregate {
  readonly code: string;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
}
interface RollupResult {
  readonly level: GeoLevel;
  readonly byRegion: ReadonlyMap<string, RegionAggregate>;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
  /** Every region total, for handing to createColorDomain. */
  readonly values: readonly number[];
}
function rollup(index: CrimeIndex, level: GeoLevel, filters: FilterSet): RollupResult;
```

Remember the convention from Task 2: **an empty `filters.categories` means "all categories", not "none".**

- [x] **Step 1: Write the failing tests**

Create `src/core/aggregation/rollup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
];

const DATA: CrimeRecord[] = [
  { year: 2022, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2022, ilCode: '34', ilceCode: '3401', category: 'darp', count: 40 },
  { year: 2022, ilCode: '34', ilceCode: '3402', category: 'hirsizlik', count: 60 },
  { year: 2023, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 200 },
  { year: 2023, ilCode: '06', ilceCode: '0601', category: 'darp', count: 30 },
];

const INDEX = buildIndex({ data: DATA, categories: CATEGORIES });
const ALL: FilterSet = { yearRange: [2022, 2023], categories: [] };

describe('rollup — il level', () => {
  it('sums ilçe records up into their parent province', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect(result.byRegion.get('34')?.total).toBe(400);
    expect(result.byRegion.get('06')?.total).toBe(30);
  });

  it('reports the national total', () => {
    expect(rollup(INDEX, 'il', ALL).total).toBe(430);
  });

  it('breaks each region down by category and by year', () => {
    const istanbul = rollup(INDEX, 'il', ALL).byRegion.get('34')!;
    expect(istanbul.byCategory.get('hirsizlik')).toBe(360);
    expect(istanbul.byCategory.get('darp')).toBe(40);
    expect(istanbul.byYear.get(2022)).toBe(200);
    expect(istanbul.byYear.get(2023)).toBe(200);
  });

  it('reports national breakdowns for the charts', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect(result.byCategory.get('hirsizlik')).toBe(360);
    expect(result.byCategory.get('darp')).toBe(70);
    expect(result.byYear.get(2022)).toBe(200);
    expect(result.byYear.get(2023)).toBe(230);
  });

  it('exposes region totals for building a color domain', () => {
    const result = rollup(INDEX, 'il', ALL);
    expect([...result.values].sort((a, b) => a - b)).toEqual([30, 400]);
  });
});

describe('rollup — ilçe level', () => {
  it('keys regions by ilçe code', () => {
    const result = rollup(INDEX, 'ilce', ALL);
    expect(result.byRegion.get('3401')?.total).toBe(340);
    expect(result.byRegion.get('3402')?.total).toBe(60);
    expect(result.byRegion.get('0601')?.total).toBe(30);
  });

  it('ignores records with no ilçe code', () => {
    const index = buildIndex({
      data: [
        { year: 2022, ilCode: '34', category: 'darp', count: 999 },
        { year: 2022, ilCode: '34', ilceCode: '3401', category: 'darp', count: 5 },
      ],
      categories: CATEGORIES,
    });
    const result = rollup(index, 'ilce', ALL);
    expect(result.total).toBe(5);
    expect(result.byRegion.size).toBe(1);
  });
});

describe('rollup — filtering', () => {
  it('restricts to the year range, inclusive at both ends', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2023], categories: [] });
    expect(result.total).toBe(230);
    expect(result.byRegion.get('34')?.total).toBe(200);
  });

  it('treats an empty category list as all categories', () => {
    const all = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: [] });
    const explicit = rollup(INDEX, 'il', {
      yearRange: [2022, 2023], categories: ['hirsizlik', 'darp'],
    });
    expect(all.total).toBe(explicit.total);
  });

  it('restricts to the selected categories', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: ['darp'] });
    expect(result.total).toBe(70);
    expect(result.byRegion.get('34')?.total).toBe(40);
  });

  it('omits regions with no matching records rather than listing them as zero', () => {
    // A region absent from the result is "no data"; a region present with 0 is
    // "measured zero". Conflating them would color unmeasured regions as safest.
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2023], categories: ['hirsizlik'] });
    expect(result.byRegion.has('06')).toBe(false);
    expect(result.byRegion.has('34')).toBe(true);
  });

  it('returns an empty result when the range matches nothing', () => {
    const result = rollup(INDEX, 'il', { yearRange: [1990, 1995], categories: [] });
    expect(result.total).toBe(0);
    expect(result.byRegion.size).toBe(0);
    expect(result.values).toEqual([]);
  });

  it('returns an empty result for an inverted year range', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2023, 2022], categories: [] });
    expect(result.total).toBe(0);
  });

  it('returns an empty result for an unknown category filter', () => {
    const result = rollup(INDEX, 'il', { yearRange: [2022, 2023], categories: ['yok'] });
    expect(result.total).toBe(0);
  });

  it('handles an empty index', () => {
    const empty = buildIndex({ data: [], categories: CATEGORIES });
    const result = rollup(empty, 'il', ALL);
    expect(result.total).toBe(0);
    expect(result.byRegion.size).toBe(0);
  });

  it('reports the level it was asked for', () => {
    expect(rollup(INDEX, 'ilce', ALL).level).toBe('ilce');
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/aggregation/rollup.test.ts`
Expected: FAIL — cannot resolve `./rollup.js`.

- [x] **Step 3: Implement `src/core/aggregation/rollup.ts`**

```ts
import type { FilterSet, GeoLevel } from '@/core/types/index.js';
import type { CrimeIndex } from './buildIndex.js';

export interface RegionAggregate {
  readonly code: string;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
}

export interface RollupResult {
  readonly level: GeoLevel;
  readonly byRegion: ReadonlyMap<string, RegionAggregate>;
  readonly total: number;
  readonly byCategory: ReadonlyMap<string, number>;
  readonly byYear: ReadonlyMap<number, number>;
  /** Region totals, ready to hand to createColorDomain. */
  readonly values: readonly number[];
}

interface MutableAggregate {
  code: string;
  total: number;
  byCategory: Map<string, number>;
  byYear: Map<number, number>;
}

function bump<K>(map: Map<K, number>, key: K, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * Computes per-region totals for the given filters, in a single pass.
 *
 * Regions with no matching records are omitted entirely rather than emitted with
 * a zero. "No data" and "measured zero" are different facts, and rendering the
 * first as the second would paint unmeasured provinces as the safest in the
 * country.
 */
export function rollup(
  index: CrimeIndex,
  level: GeoLevel,
  filters: FilterSet,
): RollupResult {
  const [startYear, endYear] = filters.yearRange;
  // Empty category list means "all categories" (see FilterSet in core/types).
  const categoryFilter = filters.categories.length === 0
    ? null
    : new Set(filters.categories);

  const regions = new Map<string, MutableAggregate>();
  const byCategory = new Map<string, number>();
  const byYear = new Map<number, number>();
  let total = 0;

  for (const rec of index.records) {
    if (rec.year < startYear || rec.year > endYear) continue;
    if (categoryFilter !== null && !categoryFilter.has(rec.category)) continue;

    const code = level === 'il' ? rec.ilCode : rec.ilceCode;
    if (code === null) continue; // ilçe level, il-only record

    let aggregate = regions.get(code);
    if (aggregate === undefined) {
      aggregate = { code, total: 0, byCategory: new Map(), byYear: new Map() };
      regions.set(code, aggregate);
    }

    aggregate.total += rec.count;
    bump(aggregate.byCategory, rec.category, rec.count);
    bump(aggregate.byYear, rec.year, rec.count);

    bump(byCategory, rec.category, rec.count);
    bump(byYear, rec.year, rec.count);
    total += rec.count;
  }

  const values: number[] = [];
  for (const aggregate of regions.values()) values.push(aggregate.total);

  return { level, byRegion: regions, total, byCategory, byYear, values };
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/aggregation`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/aggregation/rollup.ts src/core/aggregation/rollup.test.ts
git commit -m "feat(core): add filtered per-region rollup"
```

---

## Task 12: Turkish collation and region ranking

**Files:**
- Create: `src/core/search/collate.ts`, `src/core/aggregation/rank.ts`
- Test: `src/core/search/collate.test.ts`, `src/core/aggregation/rank.test.ts`

**Interfaces:**
- Consumes: `RollupResult` (Task 11)
- Produces:
  - `compareTurkish(a: string, b: string): number` — Turkish alphabetical order
  - `rankRegions(result: RollupResult, options: RankOptions): RankedRegion[]`

```ts
type RankSort = 'total-desc' | 'total-asc' | 'name-asc' | 'name-desc';
interface RankOptions {
  sort: RankSort;
  /** Region code → display name. Codes missing from the map sort last. */
  names: ReadonlyMap<string, string>;
}
interface RankedRegion {
  code: string; name: string; total: number;
  /** Fraction of the rollup total, 0..1. Zero when the total is zero. */
  share: number;
  /** 1-based position by total, independent of the active sort. */
  rank: number;
}
```

Turkish alphabetical order is not ASCII order: `ç` follows `c`, `ı` precedes `i`, `ş` follows `s`. Sorting province names with the default comparator puts `Çorum` after `Zonguldak`, which looks broken to any Turkish reader.

- [x] **Step 1: Write the failing collation tests**

Create `src/core/search/collate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareTurkish } from './collate.js';

describe('compareTurkish', () => {
  it('orders the Turkish alphabet correctly', () => {
    const alphabet = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i',
      'j', 'k', 'l', 'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z'];
    const shuffled = [...alphabet].reverse();
    expect(shuffled.sort(compareTurkish)).toEqual(alphabet);
  });

  it('places ç after c, not after z', () => {
    expect(compareTurkish('Çorum', 'Denizli')).toBeLessThan(0);
    expect(compareTurkish('Çorum', 'Bursa')).toBeGreaterThan(0);
  });

  it('places ı before i', () => {
    expect(compareTurkish('Iğdır', 'İstanbul')).toBeLessThan(0);
  });

  it('places ş after s and ö after o', () => {
    expect(compareTurkish('Şanlıurfa', 'Tekirdağ')).toBeLessThan(0);
    expect(compareTurkish('Şanlıurfa', 'Sivas')).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(compareTurkish('ankara', 'ANKARA')).toBe(0);
  });

  it('sorts a realistic province list the way a Turkish reader expects', () => {
    const provinces = ['Zonguldak', 'Çorum', 'İstanbul', 'Iğdır', 'Şanlıurfa', 'Adana', 'Ordu'];
    expect([...provinces].sort(compareTurkish))
      .toEqual(['Adana', 'Çorum', 'Iğdır', 'İstanbul', 'Ordu', 'Şanlıurfa', 'Zonguldak']);
  });

  it('breaks prefix ties by length', () => {
    expect(compareTurkish('Kars', 'Karsantı')).toBeLessThan(0);
    expect(compareTurkish('Kars', 'Kars')).toBe(0);
  });

  it('sorts unknown characters after known ones, deterministically', () => {
    expect(compareTurkish('Wien', 'Zonguldak')).toBeGreaterThan(0);
    expect(compareTurkish('Wien', 'Wien')).toBe(0);
  });

  it('handles empty strings', () => {
    expect(compareTurkish('', '')).toBe(0);
    expect(compareTurkish('', 'a')).toBeLessThan(0);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/search/collate.test.ts`
Expected: FAIL — cannot resolve `./collate.js`.

- [x] **Step 3: Implement `src/core/search/collate.ts`**

```ts
import { toTurkishLowerCase } from './normalize.js';

/**
 * Turkish alphabetical order.
 *
 * Not ASCII order and not `String.prototype.localeCompare` — the latter needs
 * full ICU, which small-icu Node builds lack, and would silently fall back to
 * English collation. Under English collation `Çorum` sorts after `Zonguldak`,
 * which reads as a bug to any Turkish speaker.
 */
const ALPHABET = 'abcçdefgğhıijklmnoöprsştuüvyz';

const RANK: ReadonlyMap<string, number> = new Map(
  [...ALPHABET].map((letter, index) => [letter, index]),
);

/** Characters outside the alphabet sort after every letter, in code-point order. */
const UNKNOWN_BASE = ALPHABET.length;

function rankOf(char: string): number {
  const known = RANK.get(char);
  if (known !== undefined) return known;
  return UNKNOWN_BASE + (char.codePointAt(0) ?? 0);
}

/** Comparator for `Array.prototype.sort`. Case-insensitive. */
export function compareTurkish(a: string, b: string): number {
  const left = toTurkishLowerCase(a);
  const right = toTurkishLowerCase(b);

  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    const diff = rankOf(left[i]!) - rankOf(right[i]!);
    if (diff !== 0) return diff;
  }

  return left.length - right.length;
}
```

- [x] **Step 4: Run the collation tests to verify they pass**

Run: `npx vitest run src/core/search/collate.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing ranking tests**

Create `src/core/aggregation/rank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { rankRegions } from './rank.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

const DATA: CrimeRecord[] = [
  { year: 2023, ilCode: '34', category: 'hirsizlik', count: 500 },
  { year: 2023, ilCode: '06', category: 'hirsizlik', count: 300 },
  { year: 2023, ilCode: '19', category: 'hirsizlik', count: 200 },
];

const NAMES = new Map([['34', 'İstanbul'], ['06', 'Ankara'], ['19', 'Çorum']]);
const RESULT = rollup(
  buildIndex({ data: DATA, categories: CATEGORIES }),
  'il',
  { yearRange: [2023, 2023], categories: [] },
);

describe('rankRegions', () => {
  it('sorts by total descending by default', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: NAMES });
    expect(ranked.map((r) => r.code)).toEqual(['34', '06', '19']);
  });

  it('sorts by total ascending', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-asc', names: NAMES });
    expect(ranked.map((r) => r.code)).toEqual(['19', '06', '34']);
  });

  it('sorts by name using Turkish collation', () => {
    const ranked = rankRegions(RESULT, { sort: 'name-asc', names: NAMES });
    expect(ranked.map((r) => r.name)).toEqual(['Ankara', 'Çorum', 'İstanbul']);
  });

  it('sorts by name descending', () => {
    const ranked = rankRegions(RESULT, { sort: 'name-desc', names: NAMES });
    expect(ranked.map((r) => r.name)).toEqual(['İstanbul', 'Çorum', 'Ankara']);
  });

  it('computes each region share of the total', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: NAMES });
    expect(ranked[0]!.share).toBeCloseTo(0.5, 6);
    expect(ranked[1]!.share).toBeCloseTo(0.3, 6);
    expect(ranked.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 6);
  });

  it('keeps rank tied to total regardless of the active sort', () => {
    // The sidebar shows "3." next to Çorum even when sorted alphabetically.
    const byName = rankRegions(RESULT, { sort: 'name-asc', names: NAMES });
    expect(byName.find((r) => r.code === '34')!.rank).toBe(1);
    expect(byName.find((r) => r.code === '19')!.rank).toBe(3);
  });

  it('gives tied totals distinct but stable ranks', () => {
    const tied = rollup(
      buildIndex({
        data: [
          { year: 2023, ilCode: '34', category: 'hirsizlik', count: 100 },
          { year: 2023, ilCode: '06', category: 'hirsizlik', count: 100 },
        ],
        categories: CATEGORIES,
      }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    const ranked = rankRegions(tied, { sort: 'total-desc', names: NAMES });
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
    // Ties break alphabetically, so the order is reproducible across renders.
    expect(ranked[0]!.name).toBe('Ankara');
  });

  it('falls back to the code when a name is missing', () => {
    const ranked = rankRegions(RESULT, { sort: 'total-desc', names: new Map() });
    expect(ranked[0]!.name).toBe('34');
  });

  it('returns zero shares rather than NaN when the total is zero', () => {
    const empty = rollup(
      buildIndex({
        data: [{ year: 2023, ilCode: '34', category: 'hirsizlik', count: 0 }],
        categories: CATEGORIES,
      }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    const ranked = rankRegions(empty, { sort: 'total-desc', names: NAMES });
    expect(ranked[0]!.share).toBe(0);
  });

  it('returns an empty array for an empty rollup', () => {
    const empty = rollup(
      buildIndex({ data: [], categories: CATEGORIES }),
      'il',
      { yearRange: [2023, 2023], categories: [] },
    );
    expect(rankRegions(empty, { sort: 'total-desc', names: NAMES })).toEqual([]);
  });
});
```

- [x] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/core/aggregation/rank.test.ts`
Expected: FAIL — cannot resolve `./rank.js`.

- [x] **Step 7: Implement `src/core/aggregation/rank.ts`**

```ts
import { compareTurkish } from '@/core/search/collate.js';
import type { RollupResult } from './rollup.js';

export type RankSort = 'total-desc' | 'total-asc' | 'name-asc' | 'name-desc';

export interface RankOptions {
  sort: RankSort;
  /** Region code → display name. Missing codes fall back to the code itself. */
  names: ReadonlyMap<string, string>;
}

export interface RankedRegion {
  code: string;
  name: string;
  total: number;
  /** Fraction of the rollup total, 0..1. Zero when the total is zero. */
  share: number;
  /** 1-based position by total. Independent of the active sort. */
  rank: number;
}

/**
 * Orders regions for the sidebar.
 *
 * `rank` is always computed from the total, never from the active sort, so the
 * position badge next to a province stays "3." whether the list is sorted by
 * count or alphabetically. Ties break alphabetically so the order is stable
 * across renders rather than depending on Map insertion order.
 */
export function rankRegions(result: RollupResult, options: RankOptions): RankedRegion[] {
  const { names, sort } = options;

  const rows = [...result.byRegion.values()].map((aggregate) => ({
    code: aggregate.code,
    name: names.get(aggregate.code) ?? aggregate.code,
    total: aggregate.total,
    share: result.total === 0 ? 0 : aggregate.total / result.total,
    rank: 0,
  }));

  // Assign ranks from the total ordering first, before applying the display sort.
  const byTotal = [...rows].sort(
    (a, b) => b.total - a.total || compareTurkish(a.name, b.name),
  );
  byTotal.forEach((row, index) => { row.rank = index + 1; });

  switch (sort) {
    case 'total-desc':
      return byTotal;
    case 'total-asc':
      return [...byTotal].reverse();
    case 'name-asc':
      return [...rows].sort((a, b) => compareTurkish(a.name, b.name));
    case 'name-desc':
      return [...rows].sort((a, b) => compareTurkish(b.name, a.name));
  }
}
```

The `switch` has no `default` branch on purpose: `RankSort` is a closed union, so TypeScript proves the switch exhaustive and a `default` would be unreachable code that coverage could never satisfy.

- [x] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/core/aggregation src/core/search`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add src/core/search/collate.ts src/core/search/collate.test.ts src/core/aggregation/rank.ts src/core/aggregation/rank.test.ts
git commit -m "feat(core): add Turkish collation and region ranking"
```

---

## Task 13: Diff for compare mode

**Files:**
- Create: `src/core/aggregation/diff.ts`, `src/core/aggregation/index.ts`
- Test: `src/core/aggregation/diff.test.ts`

**Interfaces:**
- Consumes: `RollupResult` (Task 11)
- Produces:

```ts
interface RegionDiff {
  readonly code: string;
  readonly a: number;
  readonly b: number;
  readonly delta: number;      // a - b
  /** (a - b) / b. null when b is 0 — growth from nothing has no ratio. */
  readonly pctDelta: number | null;
}
interface DiffResult {
  readonly byRegion: ReadonlyMap<string, RegionDiff>;
  /** Largest |delta|, for building a symmetric diff color scale. */
  readonly maxAbsDelta: number;
  readonly totalA: number;
  readonly totalB: number;
}
function diffRollups(a: RollupResult, b: RollupResult): DiffResult;
```

`pctDelta` is `null` rather than `Infinity` when the baseline is zero. That distinction must survive to the UI, where Task 4's `formatPercentDelta(null)` renders an em dash instead of an absurd percentage.

- [x] **Step 1: Write the failing tests**

Create `src/core/aggregation/diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, CrimeRecord, FilterSet } from '@/core/types/index.js';
import { buildIndex } from './buildIndex.js';
import { diffRollups } from './diff.js';
import { rollup } from './rollup.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

const DATA: CrimeRecord[] = [
  { year: 2022, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2023, ilCode: '34', category: 'hirsizlik', count: 150 },
  { year: 2022, ilCode: '06', category: 'hirsizlik', count: 200 },
  { year: 2023, ilCode: '06', category: 'hirsizlik', count: 120 },
  { year: 2023, ilCode: '19', category: 'hirsizlik', count: 40 },
];

const INDEX = buildIndex({ data: DATA, categories: CATEGORIES });
const year = (y: number): FilterSet => ({ yearRange: [y, y], categories: [] });

const A = rollup(INDEX, 'il', year(2023));
const B = rollup(INDEX, 'il', year(2022));
const DIFF = diffRollups(A, B);

describe('diffRollups', () => {
  it('computes delta as A minus B', () => {
    expect(DIFF.byRegion.get('34')?.delta).toBe(50);
    expect(DIFF.byRegion.get('06')?.delta).toBe(-80);
  });

  it('computes the percentage change relative to B', () => {
    expect(DIFF.byRegion.get('34')?.pctDelta).toBeCloseTo(0.5, 6);
    expect(DIFF.byRegion.get('06')?.pctDelta).toBeCloseTo(-0.4, 6);
  });

  it('carries both sides through for the tooltip', () => {
    const istanbul = DIFF.byRegion.get('34')!;
    expect(istanbul.a).toBe(150);
    expect(istanbul.b).toBe(100);
  });

  it('includes regions present in only one side', () => {
    // Çorum appears in 2023 but not 2022. Dropping it would hide a new hotspot.
    const corum = DIFF.byRegion.get('19')!;
    expect(corum.a).toBe(40);
    expect(corum.b).toBe(0);
    expect(corum.delta).toBe(40);
  });

  it('returns null pctDelta when the baseline is zero', () => {
    // Growth from nothing has no ratio. Infinity would render as nonsense.
    expect(DIFF.byRegion.get('19')?.pctDelta).toBeNull();
  });

  it('returns zero pctDelta when both sides are zero', () => {
    const zeroed = buildIndex({
      data: [
        { year: 2022, ilCode: '34', category: 'hirsizlik', count: 0 },
        { year: 2023, ilCode: '34', category: 'hirsizlik', count: 0 },
      ],
      categories: CATEGORIES,
    });
    const diff = diffRollups(
      rollup(zeroed, 'il', year(2023)),
      rollup(zeroed, 'il', year(2022)),
    );
    expect(diff.byRegion.get('34')?.delta).toBe(0);
    expect(diff.byRegion.get('34')?.pctDelta).toBe(0);
  });

  it('reports the largest absolute delta for the color scale', () => {
    expect(DIFF.maxAbsDelta).toBe(80);
  });

  it('reports both totals', () => {
    expect(DIFF.totalA).toBe(310);
    expect(DIFF.totalB).toBe(300);
  });

  it('handles an empty A side', () => {
    const diff = diffRollups(rollup(INDEX, 'il', year(1990)), B);
    expect(diff.byRegion.get('34')?.a).toBe(0);
    expect(diff.byRegion.get('34')?.delta).toBe(-100);
    expect(diff.totalA).toBe(0);
  });

  it('handles an empty B side', () => {
    const diff = diffRollups(A, rollup(INDEX, 'il', year(1990)));
    expect(diff.byRegion.get('34')?.delta).toBe(150);
    expect(diff.byRegion.get('34')?.pctDelta).toBeNull();
  });

  it('handles both sides empty', () => {
    const empty = rollup(INDEX, 'il', year(1990));
    const diff = diffRollups(empty, empty);
    expect(diff.byRegion.size).toBe(0);
    expect(diff.maxAbsDelta).toBe(0);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/aggregation/diff.test.ts`
Expected: FAIL — cannot resolve `./diff.js`.

- [x] **Step 3: Implement `src/core/aggregation/diff.ts`**

```ts
import type { RollupResult } from './rollup.js';

export interface RegionDiff {
  readonly code: string;
  readonly a: number;
  readonly b: number;
  /** a − b. Positive means A is higher. */
  readonly delta: number;
  /** (a − b) / b. null when b is 0. */
  readonly pctDelta: number | null;
}

export interface DiffResult {
  readonly byRegion: ReadonlyMap<string, RegionDiff>;
  /** Largest |delta|, for createDiffColorScale. */
  readonly maxAbsDelta: number;
  readonly totalA: number;
  readonly totalB: number;
}

/**
 * Compares two rollups region by region for compare mode.
 *
 * The region set is the union of both sides, so a region that appears in only
 * one filter set still shows up — a district that went from zero crimes to forty
 * is exactly the change a reader is looking for, and dropping it would hide a
 * new hotspot.
 */
export function diffRollups(a: RollupResult, b: RollupResult): DiffResult {
  const codes = new Set<string>([...a.byRegion.keys(), ...b.byRegion.keys()]);
  const byRegion = new Map<string, RegionDiff>();
  let maxAbsDelta = 0;

  for (const code of codes) {
    const valueA = a.byRegion.get(code)?.total ?? 0;
    const valueB = b.byRegion.get(code)?.total ?? 0;
    const delta = valueA - valueB;

    // A zero baseline has no meaningful ratio. Returning null rather than
    // Infinity keeps the "undefined change" case visible all the way to the UI,
    // where it renders as an em dash instead of a nonsensical percentage.
    let pctDelta: number | null;
    if (valueB !== 0) pctDelta = delta / valueB;
    else if (valueA === 0) pctDelta = 0;
    else pctDelta = null;

    byRegion.set(code, { code, a: valueA, b: valueB, delta, pctDelta });
    const magnitude = Math.abs(delta);
    if (magnitude > maxAbsDelta) maxAbsDelta = magnitude;
  }

  return { byRegion, maxAbsDelta, totalA: a.total, totalB: b.total };
}
```

- [x] **Step 4: Create the barrel `src/core/aggregation/index.ts`**

```ts
export type { BuildIndexOptions, CrimeIndex } from './buildIndex.js';
export { buildIndex } from './buildIndex.js';
export type { RegionAggregate, RollupResult } from './rollup.js';
export { rollup } from './rollup.js';
export type { RankedRegion, RankOptions, RankSort } from './rank.js';
export { rankRegions } from './rank.js';
export type { DiffResult, RegionDiff } from './diff.js';
export { diffRollups } from './diff.js';
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/aggregation`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/aggregation
git commit -m "feat(core): add A-vs-B region diffing for compare mode"
```

---

## Task 14: Seeded PRNG and mock dataset

**Files:**
- Create: `src/data/mock/prng.ts`, `src/data/mock/categories.ts`, `src/data/mock/generate.ts`, `src/data/mock/index.ts`
- Test: `src/data/mock/prng.test.ts`, `src/data/mock/generate.test.ts`

**Interfaces:**
- Consumes: `IL_REGIONS` (Task 5), `CrimeRecord`, `CrimeCategory`, `RegionPopulation`
- Produces:
  - `createPrng(seed: number): () => number` — uniform in [0, 1)
  - `MOCK_CATEGORIES: readonly CrimeCategory[]` — 8 Turkish crime categories
  - `generateMockData(options?: MockDataOptions): MockDataset`

```ts
interface MockDataOptions {
  seed?: number;              // default 20260801
  years?: readonly number[];  // default 2015..2024
  /** Districts generated per province. Default 4–18, weighted by province size. */
  includeIlce?: boolean;      // default true
  includePopulation?: boolean;// default true
}
interface MockDataset {
  records: CrimeRecord[];
  categories: CrimeCategory[];
  population: RegionPopulation[];
  /** Synthetic ilçe code → name, matching the generated records. */
  ilceNames: Map<string, string>;
}
```

This is demo data, and the API docs must say so plainly. It exists to drive the playground, the tests, and the README — not to describe reality.

- [x] **Step 1: Write the failing PRNG tests**

Create `src/data/mock/prng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPrng } from './prng.js';

describe('createPrng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPrng(42);
    const b = createPrng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, createPrng(1));
    const b = Array.from({ length: 20 }, createPrng(2));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const next = createPrng(7);
    for (let i = 0; i < 5000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads roughly uniformly across ten buckets', () => {
    const next = createPrng(99);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i += 1) {
      buckets[Math.floor(next() * 10)]! += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(8_000);
      expect(count).toBeLessThan(12_000);
    }
  });

  it('accepts a zero seed', () => {
    expect(() => createPrng(0)()).not.toThrow();
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/mock`
Expected: FAIL — cannot resolve `./prng.js`.

- [x] **Step 3: Implement `src/data/mock/prng.ts`**

```ts
/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * The library forbids `Math.random()` outright: mock data feeds the tests, the
 * playground, and the documentation screenshots, and all three must be
 * byte-reproducible from a seed. A flaky dataset makes every downstream test
 * flaky with it.
 *
 * Not cryptographically secure, and not intended to be.
 */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
```

- [x] **Step 4: Implement `src/data/mock/categories.ts`**

```ts
import type { CrimeCategory } from '@/core/types/index.js';

/**
 * Demo crime categories, loosely modelled on TÜİK's published groupings.
 * Illustrative only — not an official taxonomy.
 */
export const MOCK_CATEGORIES: readonly CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'yaralama', label: 'Yaralama' },
  { id: 'dolandiricilik', label: 'Dolandırıcılık' },
  { id: 'uyusturucu', label: 'Uyuşturucu' },
  { id: 'gasp', label: 'Gasp' },
  { id: 'trafik', label: 'Trafik Suçları' },
  { id: 'siber', label: 'Siber Suçlar' },
  { id: 'kacakcilik', label: 'Kaçakçılık' },
];
```

- [x] **Step 5: Write the failing generator tests**

Create `src/data/mock/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildIndex } from '@/core/aggregation/index.js';
import { ilCodeFromIlceCode } from '@/data/geo/region-meta.js';
import { MOCK_CATEGORIES } from './categories.js';
import { generateMockData } from './generate.js';

describe('generateMockData', () => {
  it('is fully reproducible from a seed', () => {
    expect(generateMockData({ seed: 5 }).records)
      .toEqual(generateMockData({ seed: 5 }).records);
  });

  it('produces different data for a different seed', () => {
    expect(generateMockData({ seed: 1 }).records)
      .not.toEqual(generateMockData({ seed: 2 }).records);
  });

  it('covers all 81 provinces', () => {
    const { records } = generateMockData();
    expect(new Set(records.map((r) => r.ilCode)).size).toBe(81);
  });

  it('covers ten years by default', () => {
    const { records } = generateMockData();
    expect(new Set(records.map((r) => r.year)).size).toBe(10);
  });

  it('covers every category', () => {
    const { records, categories } = generateMockData();
    expect(new Set(records.map((r) => r.category)).size).toBe(categories.length);
    expect(categories).toEqual(MOCK_CATEGORIES);
  });

  it('generates ilçe codes whose parent is the province they sit in', () => {
    const { records } = generateMockData();
    for (const rec of records) {
      expect(rec.ilceCode).toBeDefined();
      expect(ilCodeFromIlceCode(rec.ilceCode!)).toBe(rec.ilCode);
    }
  });

  it('names every generated ilçe code', () => {
    const { records, ilceNames } = generateMockData();
    for (const rec of records) {
      expect(ilceNames.get(rec.ilceCode!)).toBeTruthy();
    }
  });

  it('emits only non-negative integer counts', () => {
    for (const rec of generateMockData().records) {
      expect(Number.isInteger(rec.count)).toBe(true);
      expect(rec.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('passes buildIndex validation with no warnings', () => {
    // The generator's whole purpose is to be valid input. If this fails, either
    // the generator or the validator has drifted.
    const { records, categories } = generateMockData();
    const index = buildIndex({ data: records, categories });
    expect(index.warnings).toEqual([]);
    expect(index.records).toHaveLength(records.length);
  });

  it('produces a right-skewed distribution, as real crime data is', () => {
    // İstanbul should dominate; this is what makes quantile scaling necessary.
    const { records } = generateMockData();
    const totals = new Map<string, number>();
    for (const rec of records) {
      totals.set(rec.ilCode, (totals.get(rec.ilCode) ?? 0) + rec.count);
    }
    const sorted = [...totals.values()].sort((a, b) => b - a);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(sorted[0]!).toBeGreaterThan(median * 5);
    expect(totals.get('34')!).toBe(sorted[0]);
  });

  it('respects an explicit year list', () => {
    const { records } = generateMockData({ years: [2020, 2021] });
    expect(new Set(records.map((r) => r.year))).toEqual(new Set([2020, 2021]));
  });

  it('omits ilçe codes when asked', () => {
    const { records } = generateMockData({ includeIlce: false });
    expect(records.every((r) => r.ilceCode === undefined)).toBe(true);
    expect(buildIndex({ data: records, categories: MOCK_CATEGORIES }).hasIlceData).toBe(false);
  });

  it('omits population when asked', () => {
    expect(generateMockData({ includePopulation: false }).population).toEqual([]);
  });

  it('generates one population row per province per year', () => {
    const { population } = generateMockData({ years: [2020, 2021] });
    expect(population).toHaveLength(81 * 2);
    expect(population.every((p) => p.population > 0)).toBe(true);
  });

  it('handles an empty year list without throwing', () => {
    const { records } = generateMockData({ years: [] });
    expect(records).toEqual([]);
  });
});
```

- [x] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/data/mock/generate.test.ts`
Expected: FAIL — cannot resolve `./generate.js`.

- [x] **Step 7: Implement `src/data/mock/generate.ts`**

```ts
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

/** District count scales with province size, so İstanbul gets more than Bayburt. */
function districtCount(weight: number): number {
  if (weight >= 40) return 18;
  if (weight >= 15) return 12;
  if (weight >= 8) return 8;
  return 5;
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

    for (const year of years) {
      // A gentle national trend plus per-province noise, so the trend chart has
      // something to show rather than a flat line.
      const yearIndex = years.indexOf(year);
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
```

- [x] **Step 8: Create the barrel `src/data/mock/index.ts`**

```ts
export { createPrng } from './prng.js';
export { MOCK_CATEGORIES } from './categories.js';
export type { MockDataOptions, MockDataset } from './generate.js';
export { generateMockData } from './generate.js';
```

- [x] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/data/mock`
Expected: PASS.

If the right-skew test fails, `IL_WEIGHTS['34']` is being diluted by the random factors — widen the gap between İstanbul's weight and `DEFAULT_WEIGHT` rather than loosening the assertion. The skew is the point.

- [x] **Step 10: Commit**

```bash
git add src/data/mock
git commit -m "feat(data): add seeded PRNG and reproducible mock crime dataset"
```

---

## Task 15: Aggregation performance guard

A realistic-scale test that fails loudly if aggregation regresses. The spec's budget is **filter change → all panels updated in under 100 ms**; aggregation is the dominant cost inside it, so it gets a tighter budget of its own.

**Files:**
- Create: `src/core/aggregation/performance.test.ts`

**Interfaces:**
- Consumes: `generateMockData` (Task 14), `buildIndex` / `rollup` / `rankRegions` / `diffRollups` (Tasks 10–13)
- Produces: nothing. This is a guard, not a module.

- [x] **Step 1: Write the performance test**

Create `src/core/aggregation/performance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateMockData } from '@/data/mock/index.js';
import { IL_BY_CODE } from '@/data/geo/region-meta.js';
import type { FilterSet } from '@/core/types/index.js';
import { buildIndex, diffRollups, rankRegions, rollup } from './index.js';

/**
 * Guards the spec's performance budget: a filter change must update every panel
 * in under 100 ms, and aggregation is the dominant cost inside that budget.
 *
 * Thresholds are deliberately loose — roughly 5x the expected time — so this
 * catches genuine algorithmic regressions (an accidental O(n²), a rebuild of the
 * index on every filter change) without failing on a slow CI runner.
 */
describe('aggregation performance at realistic scale', () => {
  const { records, categories } = generateMockData();
  const names = new Map([...IL_BY_CODE].map(([code, meta]) => [code, meta.name]));
  const ALL: FilterSet = { yearRange: [2015, 2024], categories: [] };

  it('generates a dataset of realistic size', () => {
    // Sanity check: if this shrinks, the timings below stop meaning anything.
    expect(records.length).toBeGreaterThan(50_000);
  });

  it('builds the index in under 500 ms', () => {
    const started = performance.now();
    buildIndex({ data: records, categories });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('rolls up in under 100 ms at il level', () => {
    const index = buildIndex({ data: records, categories });
    const started = performance.now();
    rollup(index, 'il', ALL);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('rolls up in under 100 ms at ilçe level', () => {
    const index = buildIndex({ data: records, categories });
    const started = performance.now();
    rollup(index, 'ilce', ALL);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('completes a full filter-change cycle in under 150 ms', () => {
    // The realistic hot path: roll up, rank the sidebar, diff against a
    // comparison range. The index is built once and reused, as in the real app.
    const index = buildIndex({ data: records, categories });
    const started = performance.now();

    const a = rollup(index, 'il', { yearRange: [2020, 2024], categories: ['hirsizlik'] });
    const b = rollup(index, 'il', { yearRange: [2015, 2019], categories: ['hirsizlik'] });
    rankRegions(a, { sort: 'total-desc', names });
    diffRollups(a, b);

    expect(performance.now() - started).toBeLessThan(150);
  });

  it('scales roughly linearly rather than quadratically', () => {
    // A quadratic regression would blow past 4x when the data quadruples.
    const small = generateMockData({ years: [2020, 2021] });
    const large = generateMockData({ years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] });

    const time = (data: typeof small): number => {
      const index = buildIndex({ data: data.records, categories: data.categories });
      const started = performance.now();
      rollup(index, 'ilce', { yearRange: [2015, 2024], categories: [] });
      return performance.now() - started;
    };

    const smallTime = Math.max(time(small), 1);
    const largeTime = time(large);
    expect(largeTime / smallTime).toBeLessThan(12);
  });
});
```

- [x] **Step 2: Run the performance test**

Run: `npx vitest run src/core/aggregation/performance.test.ts`
Expected: PASS.

If a timing assertion fails, do not raise the threshold. Profile first: the usual causes are rebuilding the index inside the measured block, or an accidental array scan inside the per-record loop.

- [x] **Step 3: Exclude the performance test from coverage thresholds**

Performance tests exercise no new branches and would skew the coverage report. In `vitest.config.ts`, extend the coverage `exclude` list:

```ts
exclude: [
  'src/core/**/*.test.ts',
  'src/core/**/__fixtures__/**',
  'src/core/**/performance.test.ts',
],
```

- [x] **Step 4: Run the full suite with coverage**

Run: `npm run verify`
Expected: typecheck passes, lint passes, all tests pass, `src/core` at 100% branch coverage.

- [x] **Step 5: Commit**

```bash
git add src/core/aggregation/performance.test.ts vitest.config.ts
git commit -m "test(core): add aggregation performance guard at realistic scale"
```

---

## Remaining tasks (16–23)

Continued in `2026-08-01-phase-1-foundation-part-3.md`:

- **Task 16:** Geo projection — Turkey-tuned equal-area projection and fit
- **Task 17:** TopoJSON decode, memoization, and ilçe metadata derivation
- **Task 18:** Geo bounds — bbox, centroid, fit-to-region transform
- **Task 19:** Viewport culling
- **Task 20:** Search entity index
- **Task 21:** Search matching, scoring and ranking
- **Task 22:** `scripts/build-geo.ts` — source boundaries to simplified TopoJSON
- **Task 23:** Public barrel, build verification, README, and the Phase 1 exit check
