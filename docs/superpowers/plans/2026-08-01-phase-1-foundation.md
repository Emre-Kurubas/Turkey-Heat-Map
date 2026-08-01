# Türkiye Suç Haritası — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, React-free `core/` layer of the crime heat map library — aggregation, color, geography, Turkish search, and formatting — plus the build/test tooling and a seeded mock dataset, all fully unit-tested.

**Architecture:** Everything in this phase is a pure function. No React, no DOM, no network. The `core/` directory is the load-bearing logic layer that Phases 2–5 render on top of. Because it is pure, it can be tested exhaustively without rendering anything, and its correctness is provable before a single pixel is drawn.

**Tech Stack:** TypeScript 5.6, Vite 6 (library mode), Vitest 2, `d3-geo` 3, `topojson-client` 3. Node ≥ 20.

## Global Constraints

These apply to every task. Copied verbatim from the spec.

- **`core/` never imports React and never touches the DOM.** No `window`, no `document`, no `react`. Enforced by an ESLint rule added in Task 1.
- **Runtime dependencies are limited to `d3-geo` and `topojson-client`.** Anything else must be a `devDependency` or hand-written.
- **Invalid data never throws.** Validation collects warnings and drops bad rows. A library that crashes a host page over one malformed row is unacceptable.
- **No `Math.random()` anywhere in `src/` or the test path.** The mock generator uses a seeded PRNG so every test and screenshot is reproducible from a seed.
- **No `toLowerCase()` for Turkish text matching.** It breaks on the dotted/dotless İ/I pair. Use `foldTurkish` from Task 4.
- **Number formatting is hand-rolled, not `Intl`-dependent.** Some Node builds ship small-icu; output must be identical everywhere.
- **All user-facing strings are Turkish** and live in `src/i18n/tr.ts`. No hardcoded strings in `core/`.
- **Target: 100% branch coverage on `core/`,** enforced in CI from Task 1 onward.
- Region codes: **il = 2-digit zero-padded plaka code** (`"01"`–`"81"`); **ilçe = 4-digit TÜİK code** whose first two digits are the parent il code.

---

## Phase Scope

**In this phase:** build tooling, types, all `core/` modules, il region metadata, seeded mock generator, geo build script.

**Not in this phase:** any React component, any CSS, any rendering. Those are Phases 2–5.

**On real boundary data:** the geo tasks (16–19) are tested against a small synthetic TopoJSON fixture committed to the repo, not real Turkish boundaries. This is deliberate — it keeps Phase 1 fully executable and its tests fast and deterministic. Task 22 writes the build script that converts real source data, and documents how to run it. Real boundaries land at the start of Phase 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Build, type-check, test tooling |
| `eslint.config.js` | Lint + the `core/`-purity boundary rule |
| `src/core/types/*.ts` | Shared type vocabulary. No logic. |
| `src/core/search/normalize.ts` | Turkish casefolding and diacritic folding |
| `src/core/format/{number,percent,delta}.ts` | Deterministic `tr-TR` formatting |
| `src/core/color/interpolate.ts` | sRGB ↔ OKLab conversion and interpolation |
| `src/core/color/domain.ts` | linear / log / quantile value→`t` mapping |
| `src/core/color/scales.ts` | Named ramps, `createColorScale` |
| `src/core/color/legend.ts` | Legend break computation |
| `src/core/aggregation/buildIndex.ts` | Validation + normalization of raw records |
| `src/core/aggregation/rollup.ts` | Filtered totals per region |
| `src/core/aggregation/rank.ts` | Sidebar ordering + share-of-total |
| `src/core/aggregation/diff.ts` | A-vs-B deltas for compare mode |
| `src/core/geo/projection.ts` | Turkey-tuned equal-area projection |
| `src/core/geo/topology.ts` | TopoJSON decode, memoized |
| `src/core/geo/bounds.ts` | bbox, centroid, fit-to-region transform |
| `src/core/geo/viewport.ts` | Visible-feature culling |
| `src/core/search/normalize.ts` | Turkish casefolding and diacritic folding |
| `src/core/search/collate.ts` | Turkish alphabetical ordering |
| `src/core/search/entities.ts` | Searchable entity index |
| `src/core/search/match.ts` | Scoring, fuzzy matching, cross-entity ranking |
| `src/data/geo/region-meta.ts` | The 81 il codes and names |
| `src/data/mock/{prng,generate,categories}.ts` | Seeded mock dataset |
| `scripts/build-geo.ts` | Source boundaries → simplified TopoJSON |
| `src/index.ts` | Public barrel |

---

## Task 1: Project scaffolding and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `.npmrc`
- Create: `src/index.ts`, `src/core/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test`, `npm run build`, `npm run lint`, `npm run typecheck`. Every later task depends on these commands existing.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "turkiye-suc-haritasi",
  "version": "0.1.0",
  "description": "Türkiye suç istatistikleri için etkileşimli ısı haritası React bileşeni",
  "type": "module",
  "sideEffects": ["*.css"],
  "license": "MIT",
  "engines": { "node": ">=20" },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json --emitDeclarationOnly",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "verify": "npm run typecheck && npm run lint && npm run test:coverage"
  },
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
  "dependencies": {
    "d3-geo": "^3.1.1",
    "topojson-client": "^3.1.0"
  },
  "devDependencies": {
    "@types/d3-geo": "^3.1.0",
    "@types/geojson": "^7946.0.14",
    "@types/node": "^22.9.0",
    "@types/topojson-client": "^3.1.5",
    "@types/topojson-specification": "^1.0.5",
    "@vitest/coverage-v8": "^2.1.5",
    "eslint": "^9.15.0",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.15.0",
    "vite": "^6.0.1",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "scripts", "vite.config.ts", "vitest.config.ts"]
}
```

`noUncheckedIndexedAccess` matters here: this codebase indexes into arrays and maps constantly, and it forces every access to be null-checked. Leave it on even when it is annoying.

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "src/**/__fixtures__/**"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TurkiyeSucHaritasi',
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { assetFileNames: 'style.css' },
    },
    sourcemap: true,
    target: 'es2022',
  },
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      exclude: ['src/core/**/*.test.ts', 'src/core/**/__fixtures__/**'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      reporter: ['text', 'html'],
    },
  },
});
```

The `environment: 'node'` is deliberate. Phase 1 is pure logic; if a test needs a DOM, something has been put in the wrong layer. Phase 3 adds a second Vitest project with `jsdom` for components.

- [ ] **Step 6: Create `eslint.config.js` with the `core/`-purity rule**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // The core/-purity boundary. This is the rule that keeps the
    // architecture honest; do not weaken it to make a test pass.
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react', message: 'core/ must stay React-free. Move this to hooks/ or components/.' },
          { name: 'react-dom', message: 'core/ must stay React-free.' },
        ],
        patterns: [
          { group: ['@/components/*', '@/hooks/*', '@/context/*'],
            message: 'core/ must not depend on the React layers.' },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'core/ must stay DOM-free.' },
        { name: 'document', message: 'core/ must stay DOM-free.' },
        { name: 'navigator', message: 'core/ must stay DOM-free.' },
      ],
    },
  },
  {
    rules: {
      'no-restricted-properties': ['error', {
        object: 'Math', property: 'random',
        message: 'Use the seeded PRNG in src/data/mock/prng.ts. Randomness breaks reproducibility.',
      }],
    },
  },
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
);
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
coverage/
*.local
.DS_Store
```

- [ ] **Step 8: Create the placeholder barrel `src/index.ts`**

```ts
// Public API surface. Populated as modules land; see Task 23.
export {};
```

- [ ] **Step 9: Write a smoke test that proves the harness runs**

Create `src/core/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs TypeScript tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 10: Install and verify every script works**

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: `typecheck` passes silently. `lint` passes. `test` reports 1 passing test. `build` writes `dist/index.mjs`, `dist/index.cjs`, and `dist/index.d.ts`.

If `build` fails because the entry exports nothing, that is expected only if Rollup errors on an empty chunk — in that case leave the `export {}` and confirm `dist/index.mjs` exists regardless.

- [ ] **Step 11: Delete the smoke test and commit**

The smoke test has done its job; keeping it dilutes the suite. Real tests arrive in Task 2.

```bash
rm src/core/smoke.test.ts
git add -A
git commit -m "chore: scaffold TypeScript library with Vite, Vitest, and core/-purity lint rule"
```

---

## Task 2: Core type vocabulary

**Files:**
- Create: `src/core/types/data.ts`, `src/core/types/filters.ts`, `src/core/types/view.ts`, `src/core/types/index.ts`
- Test: `src/core/types/types.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CrimeRecord`, `CrimeCategory`, `RegionPopulation`, `RegionMeta`, `DataWarning`, `NormalizedRecord`, `FilterSet`, `GeoLevel`, `ScaleMode`, `Transform`, `BBox`, `Viewport`. Every later task imports from `@/core/types`.

Types alone cannot be unit-tested at runtime, so this task's test is a **compile-time** test using `expectTypeOf`. That is a real test: it fails the build if a later task changes a shape incompatibly.

- [ ] **Step 1: Create `src/core/types/data.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/core/types/filters.ts`**

```ts
export type GeoLevel = 'il' | 'ilce';

export interface FilterSet {
  /** Inclusive [start, end]. Always start <= end. */
  yearRange: [number, number];
  /** Empty array means "all categories", not "no categories". */
  categories: readonly string[];
}

export type MetricMode = 'total' | 'perCapita';
```

The "empty means all" convention is load-bearing and appears in three modules. It is chosen because it makes the default filter state trivially constructible and makes "reset" a single assignment.

- [ ] **Step 3: Create `src/core/types/view.ts`**

```ts
export type ScaleMode = 'linear' | 'log' | 'quantile';

/** SVG transform: screen = point * k + [x, y]. */
export interface Transform {
  k: number;
  x: number;
  y: number;
}

/** [[minX, minY], [maxX, maxY]] in projected (pre-transform) pixel space. */
export type BBox = [[number, number], [number, number]];

export interface Viewport {
  width: number;
  height: number;
}
```

- [ ] **Step 4: Create the barrel `src/core/types/index.ts`**

```ts
export type {
  CrimeRecord, CrimeCategory, RegionPopulation, RegionMeta,
  DataWarning, DataWarningCode, NormalizedRecord,
} from './data.js';
export type { GeoLevel, FilterSet, MetricMode } from './filters.js';
export type { ScaleMode, Transform, BBox, Viewport } from './view.js';
```

Note the `.js` extensions in relative imports. `moduleResolution: bundler` tolerates their absence, but including them keeps the source valid under Node ESM resolution too, which matters when `scripts/` is run directly with `tsx` or `node --experimental-strip-types`.

- [ ] **Step 5: Write the compile-time type test**

Create `src/core/types/types.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { CrimeRecord, FilterSet, NormalizedRecord, Transform } from './index.js';

describe('core type vocabulary', () => {
  it('CrimeRecord.ilceCode is optional, NormalizedRecord.ilceCode is nullable', () => {
    expectTypeOf<CrimeRecord['ilceCode']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NormalizedRecord['ilceCode']>().toEqualTypeOf<string | null>();
  });

  it('FilterSet.yearRange is a fixed-length pair', () => {
    expectTypeOf<FilterSet['yearRange']>().toEqualTypeOf<[number, number]>();
  });

  it('Transform carries exactly k, x, y', () => {
    expectTypeOf<Transform>().toEqualTypeOf<{ k: number; x: number; y: number }>();
  });
});
```

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run src/core/types`
Expected: typecheck passes; 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/types
git commit -m "feat(core): add shared type vocabulary"
```

---

## Task 3: Turkish text normalization

This is the highest-risk pure function in the library and the one most likely to be got wrong by someone who has not hit the İ/I problem before. It comes early so everything downstream can rely on it.

**Files:**
- Create: `src/core/search/normalize.ts`
- Test: `src/core/search/normalize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `foldTurkish(input: string): string` — search-matching fold to lowercase ASCII
  - `toTurkishLowerCase(input: string): string` — display-correct lowercase
  - `toTurkishUpperCase(input: string): string` — display-correct uppercase

- [ ] **Step 1: Write the failing tests**

Create `src/core/search/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { foldTurkish, toTurkishLowerCase, toTurkishUpperCase } from './normalize.js';

describe('foldTurkish', () => {
  it('folds every spelling of İstanbul to the same key', () => {
    const forms = ['İstanbul', 'istanbul', 'ISTANBUL', 'ıstanbul', 'Istanbul', 'İSTANBUL'];
    const folded = forms.map(foldTurkish);
    expect(new Set(folded).size).toBe(1);
    expect(folded[0]).toBe('istanbul');
  });

  it('folds Turkish-specific letters to ASCII', () => {
    expect(foldTurkish('Şişli')).toBe('sisli');
    expect(foldTurkish('Ağrı')).toBe('agri');
    expect(foldTurkish('Çorum')).toBe('corum');
    expect(foldTurkish('Gümüşhane')).toBe('gumushane');
    expect(foldTurkish('Kırşehir')).toBe('kirsehir');
    expect(foldTurkish('Diyarbakır')).toBe('diyarbakir');
    expect(foldTurkish('Şanlıurfa')).toBe('sanliurfa');
    expect(foldTurkish('Çanakkale')).toBe('canakkale');
    expect(foldTurkish('Nevşehir')).toBe('nevsehir');
    expect(foldTurkish('Muğla')).toBe('mugla');
  });

  it('folds circumflex vowels used in Turkish loanwords', () => {
    expect(foldTurkish('Kâzım')).toBe('kazim');
    expect(foldTurkish('Lâtif')).toBe('latif');
  });

  it('handles the combining-dot form produced by "İ".toLowerCase()', () => {
    // "İ".toLowerCase() is "i" + U+0307 in JS, which must not survive folding.
    const combining = 'İ'.toLowerCase() + 'stanbul';
    expect(foldTurkish(combining)).toBe('istanbul');
  });

  it('is idempotent', () => {
    const once = foldTurkish('Şanlıurfa');
    expect(foldTurkish(once)).toBe(once);
  });

  it('preserves spaces, hyphens and digits', () => {
    expect(foldTurkish('Afyonkarahisar 2023')).toBe('afyonkarahisar 2023');
    expect(foldTurkish('Şişli-Mecidiyeköy')).toBe('sisli-mecidiyekoy');
  });

  it('returns an empty string for empty input', () => {
    expect(foldTurkish('')).toBe('');
  });
});

describe('toTurkishLowerCase', () => {
  it('maps dotted capital I to dotted lowercase i', () => {
    expect(toTurkishLowerCase('İSTANBUL')).toBe('istanbul');
  });

  it('maps dotless capital I to dotless lowercase ı', () => {
    expect(toTurkishLowerCase('IĞDIR')).toBe('ığdır');
  });

  it('leaves other Turkish letters intact', () => {
    expect(toTurkishLowerCase('ŞANLIURFA')).toBe('şanlıurfa');
    expect(toTurkishLowerCase('ÇORUM')).toBe('çorum');
  });
});

describe('toTurkishUpperCase', () => {
  it('maps dotted lowercase i to dotted capital İ', () => {
    expect(toTurkishUpperCase('istanbul')).toBe('İSTANBUL');
  });

  it('maps dotless lowercase ı to dotless capital I', () => {
    expect(toTurkishUpperCase('ığdır')).toBe('IĞDIR');
  });

  it('round-trips with toTurkishLowerCase', () => {
    for (const name of ['İstanbul', 'Iğdır', 'Şanlıurfa', 'Çorum', 'Muğla']) {
      expect(toTurkishLowerCase(toTurkishUpperCase(name))).toBe(toTurkishLowerCase(name));
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/search/normalize.test.ts`
Expected: FAIL — cannot resolve `./normalize.js`.

- [ ] **Step 3: Implement `src/core/search/normalize.ts`**

```ts
/**
 * Turkish-aware text normalization.
 *
 * JavaScript's built-in case conversion is wrong for Turkish. `"I".toLowerCase()`
 * yields `"i"` (should be `"ı"`), and `"İ".toLowerCase()` yields `"i" + U+0307`
 * (a combining dot above). Both break naive search matching, so this module
 * replaces the built-ins entirely for Turkish text.
 */

/** Search fold: every variant of a letter collapses to one ASCII key. */
const FOLD_MAP: Readonly<Record<string, string>> = {
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i', İ: 'i', i: 'i',
  ö: 'o', Ö: 'o',
  ş: 's', Ş: 's',
  ü: 'u', Ü: 'u',
  â: 'a', Â: 'a',
  î: 'i', Î: 'i',
  û: 'u', Û: 'u',
};

/**
 * Folds text to a lowercase ASCII search key.
 *
 * Both `I` and `İ` fold to `i`, so a user typing `istanbul`, `ıstanbul`, or
 * `İSTANBUL` all match the same entry. This is intentionally lossier than
 * correct Turkish casing — it is for matching, never for display.
 */
export function foldTurkish(input: string): string {
  if (input === '') return '';

  let out = '';
  for (const ch of input.normalize('NFC')) {
    const mapped = FOLD_MAP[ch];
    out += mapped ?? ch.toLowerCase();
  }

  // Strip any combining marks left by characters not in FOLD_MAP.
  return out.normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

/** Locale-correct Turkish lowercase, for display. */
export function toTurkishLowerCase(input: string): string {
  return input.replace(/İ/gu, 'i').replace(/I/gu, 'ı').toLowerCase();
}

/** Locale-correct Turkish uppercase, for display. */
export function toTurkishUpperCase(input: string): string {
  return input.replace(/i/gu, 'İ').replace(/ı/gu, 'I').toUpperCase();
}
```

Why the pre-replace in `toTurkishLowerCase` rather than `toLocaleLowerCase('tr')`: the locale-aware form depends on the host's ICU data, which is absent in small-icu Node builds and inconsistent in older browsers. The explicit replacement is deterministic everywhere, which the Global Constraints require.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/search/normalize.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Verify coverage is complete for this file**

Run: `npx vitest run --coverage src/core/search/normalize.test.ts`
Expected: `normalize.ts` at 100% branches. If the `mapped ?? ch.toLowerCase()` fallback shows an uncovered branch, add a case with a non-Turkish letter such as `foldTurkish('Wien')`.

- [ ] **Step 6: Commit**

```bash
git add src/core/search/normalize.ts src/core/search/normalize.test.ts
git commit -m "feat(core): add Turkish-aware text folding and case conversion"
```

---

## Task 4: Deterministic tr-TR number formatting

**Files:**
- Create: `src/core/format/number.ts`, `src/core/format/percent.ts`, `src/core/format/delta.ts`, `src/core/format/index.ts`
- Test: `src/core/format/format.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `formatTrNumber(value: number): string` — `1234567` → `"1.234.567"`
  - `formatTrDecimal(value: number, digits: number): string` — `1.25, 1` → `"1,3"`
  - `formatCompactTr(value: number): string` — `1234567` → `"1,2 Mn"`
  - `formatPercent(ratio: number, digits?: number): string` — `0.1234` → `"%12,3"`
  - `formatDelta(delta: number): string` — `-45` → `"−45"` (U+2212 minus)
  - `formatPercentDelta(ratio: number | null): string` — `null` → `"—"`

- [ ] **Step 1: Write the failing tests**

Create `src/core/format/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatCompactTr, formatDelta, formatPercent, formatPercentDelta,
  formatTrDecimal, formatTrNumber,
} from './index.js';

describe('formatTrNumber', () => {
  it('groups thousands with periods', () => {
    expect(formatTrNumber(0)).toBe('0');
    expect(formatTrNumber(7)).toBe('7');
    expect(formatTrNumber(999)).toBe('999');
    expect(formatTrNumber(1000)).toBe('1.000');
    expect(formatTrNumber(12345)).toBe('12.345');
    expect(formatTrNumber(1234567)).toBe('1.234.567');
    expect(formatTrNumber(1000000000)).toBe('1.000.000.000');
  });

  it('handles negatives with a typographic minus', () => {
    expect(formatTrNumber(-1234)).toBe('−1.234');
  });

  it('rounds non-integers', () => {
    expect(formatTrNumber(1234.6)).toBe('1.235');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatTrNumber(Number.NaN)).toBe('—');
    expect(formatTrNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatTrNumber(Number.NEGATIVE_INFINITY)).toBe('—');
  });
});

describe('formatTrDecimal', () => {
  it('uses a comma as the decimal separator', () => {
    expect(formatTrDecimal(1.25, 1)).toBe('1,3');
    expect(formatTrDecimal(3.14159, 2)).toBe('3,14');
    expect(formatTrDecimal(1234.5, 1)).toBe('1.234,5');
  });

  it('pads to the requested digit count', () => {
    expect(formatTrDecimal(2, 2)).toBe('2,00');
  });

  it('omits the separator when digits is 0', () => {
    expect(formatTrDecimal(2.7, 0)).toBe('3');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatTrDecimal(Number.NaN, 2)).toBe('—');
  });
});

describe('formatCompactTr', () => {
  it('leaves values below 1000 alone', () => {
    expect(formatCompactTr(0)).toBe('0');
    expect(formatCompactTr(999)).toBe('999');
  });

  it('abbreviates thousands as "B" (bin)', () => {
    expect(formatCompactTr(1000)).toBe('1,0 B');
    expect(formatCompactTr(12500)).toBe('12,5 B');
  });

  it('abbreviates millions as "Mn" and billions as "Mr"', () => {
    expect(formatCompactTr(1234567)).toBe('1,2 Mn');
    expect(formatCompactTr(2500000000)).toBe('2,5 Mr');
  });

  it('abbreviates negatives symmetrically', () => {
    expect(formatCompactTr(-12500)).toBe('−12,5 B');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatCompactTr(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('puts the percent sign first, as Turkish does', () => {
    expect(formatPercent(0.1234)).toBe('%12,3');
    expect(formatPercent(1)).toBe('%100,0');
    expect(formatPercent(0)).toBe('%0,0');
  });

  it('respects the digit count', () => {
    expect(formatPercent(0.1234, 2)).toBe('%12,34');
    expect(formatPercent(0.1234, 0)).toBe('%12');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('prefixes positives with a plus and negatives with a typographic minus', () => {
    expect(formatDelta(45)).toBe('+45');
    expect(formatDelta(-45)).toBe('−45');
    expect(formatDelta(1234)).toBe('+1.234');
  });

  it('renders zero without a sign', () => {
    expect(formatDelta(0)).toBe('0');
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatDelta(Number.NaN)).toBe('—');
  });
});

describe('formatPercentDelta', () => {
  it('renders a signed percentage', () => {
    expect(formatPercentDelta(0.15)).toBe('+%15,0');
    expect(formatPercentDelta(-0.075)).toBe('−%7,5');
    expect(formatPercentDelta(0)).toBe('%0,0');
  });

  it('renders an em dash when the change is undefined', () => {
    // Undefined happens when the baseline is zero: growth from nothing has no ratio.
    expect(formatPercentDelta(null)).toBe('—');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/format`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Implement `src/core/format/number.ts`**

```ts
/**
 * Deterministic tr-TR number formatting.
 *
 * Deliberately hand-rolled rather than using `Intl.NumberFormat`: some Node
 * builds ship with small-icu, where `tr-TR` silently falls back to `en-US` and
 * produces `1,234,567` instead of `1.234.567`. Formatting must be byte-identical
 * in tests, in CI, and in every browser.
 */

/** U+2212 MINUS SIGN. Visually balanced with digits, unlike the hyphen. */
export const MINUS = '−';
/** Placeholder for values that do not exist. */
export const EM_DASH = '—';

const GROUP_SEPARATOR = '.';
const DECIMAL_SEPARATOR = ',';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/gu, GROUP_SEPARATOR);
}

/** Formats an integer with `.` thousands separators. Rounds non-integers. */
export function formatTrNumber(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  return sign + groupThousands(Math.abs(rounded).toFixed(0));
}

/** Formats with a fixed number of decimals, using `,` as the decimal separator. */
export function formatTrDecimal(value: number, digits: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const sign = value < 0 ? MINUS : '';
  const fixed = Math.abs(value).toFixed(digits);
  const [intPart = '0', fracPart] = fixed.split('.');
  const grouped = groupThousands(intPart);

  return fracPart === undefined
    ? sign + grouped
    : sign + grouped + DECIMAL_SEPARATOR + fracPart;
}

const COMPACT_UNITS: readonly { readonly threshold: number; readonly suffix: string }[] = [
  { threshold: 1_000_000_000, suffix: 'Mr' }, // milyar
  { threshold: 1_000_000, suffix: 'Mn' },     // milyon
  { threshold: 1_000, suffix: 'B' },          // bin
];

/** Abbreviates large numbers using Turkish unit suffixes: B, Mn, Mr. */
export function formatCompactTr(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const abs = Math.abs(value);
  for (const { threshold, suffix } of COMPACT_UNITS) {
    if (abs >= threshold) {
      return `${formatTrDecimal(value / threshold, 1)} ${suffix}`;
    }
  }
  return formatTrNumber(value);
}
```

- [ ] **Step 4: Implement `src/core/format/percent.ts`**

```ts
import { EM_DASH, formatTrDecimal } from './number.js';

/**
 * Formats a 0..1 ratio as a Turkish percentage.
 *
 * Turkish writes the percent sign *before* the number: `%12,3`, not `12,3%`.
 */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return EM_DASH;
  return `%${formatTrDecimal(ratio * 100, digits)}`;
}
```

- [ ] **Step 5: Implement `src/core/format/delta.ts`**

```ts
import { EM_DASH, MINUS, formatTrDecimal, formatTrNumber } from './number.js';

/** Formats an absolute change with an explicit sign. Zero carries no sign. */
export function formatDelta(delta: number): string {
  if (!Number.isFinite(delta)) return EM_DASH;
  if (delta === 0) return '0';
  return delta > 0 ? `+${formatTrNumber(delta)}` : formatTrNumber(delta);
}

/**
 * Formats a signed percentage change.
 *
 * `null` means the change is undefined — which happens whenever the baseline is
 * zero, since growth from nothing has no meaningful ratio. Callers must pass
 * null rather than Infinity so the distinction survives to the UI.
 */
export function formatPercentDelta(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return EM_DASH;

  const magnitude = `%${formatTrDecimal(Math.abs(ratio) * 100, 1)}`;
  if (ratio === 0) return magnitude;
  return ratio > 0 ? `+${magnitude}` : `${MINUS}${magnitude}`;
}
```

- [ ] **Step 6: Create the barrel `src/core/format/index.ts`**

```ts
export { EM_DASH, MINUS, formatCompactTr, formatTrDecimal, formatTrNumber } from './number.js';
export { formatPercent } from './percent.js';
export { formatDelta, formatPercentDelta } from './delta.js';
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/core/format`
Expected: PASS, all tests green.

Note `formatTrDecimal(2.7, 0)` returning `"3"`: `toFixed(0)` produces no `.`, so `fracPart` is `undefined` and the separator is correctly omitted. That branch is covered by the "omits the separator when digits is 0" test.

- [ ] **Step 8: Commit**

```bash
git add src/core/format
git commit -m "feat(core): add deterministic tr-TR number, percent and delta formatting"
```

---

## Task 5: İl region metadata

**Files:**
- Create: `src/data/geo/region-meta.ts`
- Test: `src/data/geo/region-meta.test.ts`

**Interfaces:**
- Consumes: `RegionMeta` from `@/core/types`
- Produces:
  - `IL_REGIONS: readonly RegionMeta[]` — all 81 provinces
  - `IL_BY_CODE: ReadonlyMap<string, RegionMeta>`
  - `isValidIlCode(code: string): boolean`
  - `ilCodeFromIlceCode(ilceCode: string): string | null`

İlçe metadata is **not** hand-written — 973 entries would be unmaintainable and would duplicate the boundary data. It is derived from the TopoJSON in Task 17.

- [ ] **Step 1: Write the failing tests**

Create `src/data/geo/region-meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { foldTurkish } from '@/core/search/normalize.js';
import { IL_BY_CODE, IL_REGIONS, ilCodeFromIlceCode, isValidIlCode } from './region-meta.js';

describe('IL_REGIONS', () => {
  it('contains exactly 81 provinces', () => {
    expect(IL_REGIONS).toHaveLength(81);
  });

  it('uses zero-padded two-digit codes from 01 to 81 with no gaps', () => {
    const codes = IL_REGIONS.map((r) => r.code).sort();
    const expected = Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(2, '0')).sort();
    expect(codes).toEqual(expected);
  });

  it('has no duplicate codes or names', () => {
    expect(new Set(IL_REGIONS.map((r) => r.code)).size).toBe(81);
    expect(new Set(IL_REGIONS.map((r) => r.name)).size).toBe(81);
  });

  it('gives every il a null parentCode', () => {
    expect(IL_REGIONS.every((r) => r.parentCode === null)).toBe(true);
  });

  it('maps well-known plaka codes to the right provinces', () => {
    expect(IL_BY_CODE.get('01')?.name).toBe('Adana');
    expect(IL_BY_CODE.get('06')?.name).toBe('Ankara');
    expect(IL_BY_CODE.get('34')?.name).toBe('İstanbul');
    expect(IL_BY_CODE.get('35')?.name).toBe('İzmir');
    expect(IL_BY_CODE.get('81')?.name).toBe('Düzce');
  });

  it('spells province names with correct Turkish orthography', () => {
    // A name stored without its diacritics would fold to a different key and
    // silently break search. Spot-check the ones most often mis-typed.
    expect(IL_BY_CODE.get('34')?.name).toBe('İstanbul');
    expect(foldTurkish(IL_BY_CODE.get('34')!.name)).toBe('istanbul');
    expect(IL_BY_CODE.get('63')?.name).toBe('Şanlıurfa');
    expect(IL_BY_CODE.get('21')?.name).toBe('Diyarbakır');
    expect(IL_BY_CODE.get('76')?.name).toBe('Iğdır');
    expect(IL_BY_CODE.get('29')?.name).toBe('Gümüşhane');
  });
});

describe('isValidIlCode', () => {
  it('accepts real plaka codes', () => {
    expect(isValidIlCode('01')).toBe(true);
    expect(isValidIlCode('81')).toBe(true);
  });

  it('rejects out-of-range, unpadded and malformed codes', () => {
    expect(isValidIlCode('82')).toBe(false);
    expect(isValidIlCode('00')).toBe(false);
    expect(isValidIlCode('1')).toBe(false);
    expect(isValidIlCode('')).toBe(false);
    expect(isValidIlCode('ab')).toBe(false);
  });
});

describe('ilCodeFromIlceCode', () => {
  it('takes the first two digits as the parent province', () => {
    expect(ilCodeFromIlceCode('3401')).toBe('34');
    expect(ilCodeFromIlceCode('0612')).toBe('06');
  });

  it('returns null when the code is malformed or names no real province', () => {
    expect(ilCodeFromIlceCode('9901')).toBeNull();
    expect(ilCodeFromIlceCode('340')).toBeNull();
    expect(ilCodeFromIlceCode('34011')).toBeNull();
    expect(ilCodeFromIlceCode('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/geo`
Expected: FAIL — cannot resolve `./region-meta.js`.

- [ ] **Step 3: Implement `src/data/geo/region-meta.ts`**

The province list is fixed reference data. Transcribe it exactly — the diacritics are load-bearing, because a name stored as `Sanliurfa` folds to a different search key than `Şanlıurfa` and would break Task 20's search.

```ts
import type { RegionMeta } from '@/core/types/index.js';

/** Province name by official plaka code. Reference data; do not reorder. */
const IL_NAMES: Readonly<Record<string, string>> = {
  '01': 'Adana',        '02': 'Adıyaman',    '03': 'Afyonkarahisar', '04': 'Ağrı',
  '05': 'Amasya',       '06': 'Ankara',      '07': 'Antalya',        '08': 'Artvin',
  '09': 'Aydın',        '10': 'Balıkesir',   '11': 'Bilecik',        '12': 'Bingöl',
  '13': 'Bitlis',       '14': 'Bolu',        '15': 'Burdur',         '16': 'Bursa',
  '17': 'Çanakkale',    '18': 'Çankırı',     '19': 'Çorum',          '20': 'Denizli',
  '21': 'Diyarbakır',   '22': 'Edirne',      '23': 'Elazığ',         '24': 'Erzincan',
  '25': 'Erzurum',      '26': 'Eskişehir',   '27': 'Gaziantep',      '28': 'Giresun',
  '29': 'Gümüşhane',    '30': 'Hakkâri',     '31': 'Hatay',          '32': 'Isparta',
  '33': 'Mersin',       '34': 'İstanbul',    '35': 'İzmir',          '36': 'Kars',
  '37': 'Kastamonu',    '38': 'Kayseri',     '39': 'Kırklareli',     '40': 'Kırşehir',
  '41': 'Kocaeli',      '42': 'Konya',       '43': 'Kütahya',        '44': 'Malatya',
  '45': 'Manisa',       '46': 'Kahramanmaraş', '47': 'Mardin',       '48': 'Muğla',
  '49': 'Muş',          '50': 'Nevşehir',    '51': 'Niğde',          '52': 'Ordu',
  '53': 'Rize',         '54': 'Sakarya',     '55': 'Samsun',         '56': 'Siirt',
  '57': 'Sinop',        '58': 'Sivas',       '59': 'Tekirdağ',       '60': 'Tokat',
  '61': 'Trabzon',      '62': 'Tunceli',     '63': 'Şanlıurfa',      '64': 'Uşak',
  '65': 'Van',          '66': 'Yozgat',      '67': 'Zonguldak',      '68': 'Aksaray',
  '69': 'Bayburt',      '70': 'Karaman',     '71': 'Kırıkkale',      '72': 'Batman',
  '73': 'Şırnak',       '74': 'Bartın',      '75': 'Ardahan',        '76': 'Iğdır',
  '77': 'Yalova',       '78': 'Karabük',     '79': 'Kilis',          '80': 'Osmaniye',
  '81': 'Düzce',
};

export const IL_REGIONS: readonly RegionMeta[] = Object.entries(IL_NAMES).map(
  ([code, name]) => ({ code, name, parentCode: null }),
);

export const IL_BY_CODE: ReadonlyMap<string, RegionMeta> = new Map(
  IL_REGIONS.map((region) => [region.code, region]),
);

/** True when `code` is a real, correctly zero-padded plaka code. */
export function isValidIlCode(code: string): boolean {
  return IL_BY_CODE.has(code);
}

/**
 * Derives the parent province code from a 4-digit ilçe code.
 * Returns null if the code is malformed or names no real province.
 */
export function ilCodeFromIlceCode(ilceCode: string): string | null {
  if (!/^\d{4}$/u.test(ilceCode)) return null;
  const ilCode = ilceCode.slice(0, 2);
  return isValidIlCode(ilCode) ? ilCode : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/geo`
Expected: PASS. If the count assertion fails, a province is missing or duplicated — compare against the code range test output, which names the gap.

- [ ] **Step 5: Commit**

```bash
git add src/data/geo/region-meta.ts src/data/geo/region-meta.test.ts
git commit -m "feat(data): add il region metadata with plaka codes"
```

---

## Task 6: OKLab color interpolation

**Files:**
- Create: `src/core/color/interpolate.ts`
- Test: `src/core/color/interpolate.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `parseHex(hex: string): RGB | null`
  - `toHex(rgb: RGB): string`
  - `rgbToOklab(rgb: RGB): Oklab`
  - `oklabToRgb(lab: Oklab): RGB`
  - `interpolateOklab(from: string, to: string, t: number): string`
  - `createRamp(stops: readonly string[]): (t: number) => string`
  - types `RGB { r, g, b }` (0–255) and `Oklab { L, a, b }`

Interpolating in sRGB produces muddy grey-brown bands between blue and red. OKLab is perceptually uniform, so the midpoint of a ramp looks like the midpoint.

- [ ] **Step 1: Write the failing tests**

Create `src/core/color/interpolate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createRamp, interpolateOklab, oklabToRgb, parseHex, rgbToOklab, toHex,
} from './interpolate.js';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#00ff80')).toEqual({ r: 0, g: 255, b: 128 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('is case-insensitive and tolerates a missing hash', () => {
    expect(parseHex('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for malformed input', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#gg0000')).toBeNull();
    expect(parseHex('#ff00')).toBeNull();
    expect(parseHex('rgb(255,0,0)')).toBeNull();
  });
});

describe('toHex', () => {
  it('renders lowercase 6-digit hex', () => {
    expect(toHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(toHex({ r: 0, g: 128, b: 255 })).toBe('#0080ff');
  });

  it('clamps and rounds out-of-gamut channels', () => {
    expect(toHex({ r: 300, g: -20, b: 127.6 })).toBe('#ff0080');
  });
});

describe('OKLab round-trip', () => {
  it('recovers the original color within one 8-bit step', () => {
    const samples = [
      { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 },
      { r: 18, g: 99, b: 220 }, { r: 240, g: 180, b: 30 }, { r: 127, g: 127, b: 127 },
    ];
    for (const rgb of samples) {
      const back = oklabToRgb(rgbToOklab(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it('gives white an L near 1 and black an L near 0', () => {
    expect(rgbToOklab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(1, 2);
    expect(rgbToOklab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 2);
  });
});

describe('interpolateOklab', () => {
  it('returns the endpoints exactly at t=0 and t=1', () => {
    expect(interpolateOklab('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(interpolateOklab('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('clamps t outside [0, 1]', () => {
    expect(interpolateOklab('#ff0000', '#0000ff', -5)).toBe('#ff0000');
    expect(interpolateOklab('#ff0000', '#0000ff', 5)).toBe('#0000ff');
  });

  it('does not desaturate to grey at the midpoint', () => {
    // The sRGB midpoint of red and blue is a muddy #7f007f-ish tone with low
    // chroma. OKLab keeps chroma up; assert the result is meaningfully colorful.
    const mid = interpolateOklab('#ff0000', '#0000ff', 0.5);
    const lab = rgbToOklab(parseHex(mid)!);
    const chroma = Math.hypot(lab.a, lab.b);
    expect(chroma).toBeGreaterThan(0.1);
  });

  it('varies monotonically in lightness between two greys', () => {
    const lightness = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => rgbToOklab(parseHex(interpolateOklab('#000000', '#ffffff', t))!).L,
    );
    for (let i = 1; i < lightness.length; i += 1) {
      expect(lightness[i]!).toBeGreaterThan(lightness[i - 1]!);
    }
  });

  it('falls back to the destination color when a stop is unparseable', () => {
    expect(interpolateOklab('not-a-color', '#0000ff', 0.5)).toBe('#0000ff');
    expect(interpolateOklab('#ff0000', 'not-a-color', 0.5)).toBe('#ff0000');
  });
});

describe('createRamp', () => {
  const ramp = createRamp(['#0000ff', '#00ff00', '#ff0000']);

  it('returns the first stop at t=0 and the last at t=1', () => {
    expect(ramp(0)).toBe('#0000ff');
    expect(ramp(1)).toBe('#ff0000');
  });

  it('hits interior stops exactly at their positions', () => {
    expect(ramp(0.5)).toBe('#00ff00');
  });

  it('clamps out-of-range t', () => {
    expect(ramp(-1)).toBe('#0000ff');
    expect(ramp(2)).toBe('#ff0000');
  });

  it('handles a single-stop ramp as a constant', () => {
    const flat = createRamp(['#123456']);
    expect(flat(0)).toBe('#123456');
    expect(flat(0.5)).toBe('#123456');
    expect(flat(1)).toBe('#123456');
  });

  it('throws when given no stops, because that is a programming error', () => {
    expect(() => createRamp([])).toThrow(/en az bir renk/u);
  });

  it('produces a continuous ramp with no repeated adjacent colors', () => {
    const samples = Array.from({ length: 21 }, (_, i) => ramp(i / 20));
    expect(new Set(samples).size).toBeGreaterThan(15);
  });
});
```

Note: `createRamp([])` throwing is the one place in `core/` that throws. It is not a data error — it is a programming error in the consumer's `colorScale` prop, caught at development time, and the spec's "invalid data never throws" rule is about the `data` prop.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/color`
Expected: FAIL — cannot resolve `./interpolate.js`.

- [ ] **Step 3: Implement `src/core/color/interpolate.ts`**

```ts
/**
 * sRGB ↔ OKLab conversion and perceptually-uniform interpolation.
 *
 * Interpolating in sRGB drags the path through low-chroma territory, so a blue→red
 * ramp passes through a muddy grey-purple. OKLab is perceptually uniform: equal
 * steps in the space look like equal steps to the eye, so the ramp stays vivid and
 * the midpoint reads as the midpoint.
 *
 * Matrices from Björn Ottosson's OKLab derivation.
 */

export interface RGB { r: number; g: number; b: number }
export interface Oklab { L: number; a: number; b: number }

const HEX_PATTERN = /^#?(?:([\da-f]{3})|([\da-f]{6}))$/iu;

/** Parses `#rgb`, `#rrggbb`, with or without the hash. Returns null if malformed. */
export function parseHex(hex: string): RGB | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (match === null) return null;

  const short = match[1];
  const full = match[2] ?? (short === undefined ? undefined : short.replace(/./gu, '$&$&'));
  if (full === undefined) return null;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function clampChannel(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

/** Renders an RGB triple as lowercase `#rrggbb`, clamping out-of-gamut channels. */
export function toHex({ r, g, b }: RGB): string {
  const hex = (value: number) => clampChannel(value).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** sRGB gamma decode: 0..255 → linear 0..1. */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB gamma encode: linear 0..1 → 0..255. */
function fromLinear(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return c * 255;
}

export function rgbToOklab(rgb: RGB): Oklab {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = 0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b;
  const m = 0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b;
  const s = 0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.210_454_255_3 * l_ + 0.793_617_785_0 * m_ - 0.004_072_046_8 * s_,
    a: 1.977_998_495_1 * l_ - 2.428_592_205_0 * m_ + 0.450_593_709_9 * s_,
    b: 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766_0 * s_,
  };
}

export function oklabToRgb(lab: Oklab): RGB {
  const l_ = lab.L + 0.396_337_777_4 * lab.a + 0.215_803_757_3 * lab.b;
  const m_ = lab.L - 0.105_561_345_8 * lab.a - 0.063_854_172_8 * lab.b;
  const s_ = lab.L - 0.089_484_177_5 * lab.a - 1.291_485_548_0 * lab.b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: fromLinear(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s),
    g: fromLinear(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s),
    b: fromLinear(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701_0 * s),
  };
}

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Interpolates between two hex colors through OKLab.
 * If a stop is unparseable, returns the other stop rather than throwing —
 * a bad color in a theme should degrade, not break the render.
 */
export function interpolateOklab(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (a === null) return b === null ? '#000000' : toHex(b);
  if (b === null) return toHex(a);

  const clamped = clamp01(t);
  if (clamped === 0) return toHex(a);
  if (clamped === 1) return toHex(b);

  const labA = rgbToOklab(a);
  const labB = rgbToOklab(b);

  return toHex(oklabToRgb({
    L: labA.L + (labB.L - labA.L) * clamped,
    a: labA.a + (labB.a - labA.a) * clamped,
    b: labA.b + (labB.b - labA.b) * clamped,
  }));
}

/**
 * Builds a multi-stop ramp. Stops are spaced evenly across [0, 1].
 * Throws on an empty stop list: that is a programming error in the caller's
 * configuration, not a data error, and should surface immediately.
 */
export function createRamp(stops: readonly string[]): (t: number) => string {
  if (stops.length === 0) {
    throw new Error('createRamp: en az bir renk durağı gerekli.');
  }

  const first = stops[0]!;
  if (stops.length === 1) {
    const constant = toHex(parseHex(first) ?? { r: 0, g: 0, b: 0 });
    return () => constant;
  }

  const segments = stops.length - 1;

  return (t: number): string => {
    const clamped = clamp01(t);
    if (clamped === 1) return toHex(parseHex(stops[segments]!) ?? { r: 0, g: 0, b: 0 });

    const scaled = clamped * segments;
    const index = Math.floor(scaled);
    return interpolateOklab(stops[index]!, stops[index + 1]!, scaled - index);
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/color`
Expected: PASS. If the round-trip test drifts by more than 1, a matrix coefficient has been transcribed wrong — compare against Ottosson's published values digit by digit.

- [ ] **Step 5: Commit**

```bash
git add src/core/color/interpolate.ts src/core/color/interpolate.test.ts
git commit -m "feat(core): add OKLab color conversion and perceptual interpolation"
```

---

## Task 7: Color domains (linear, log, quantile)

**Files:**
- Create: `src/core/color/domain.ts`
- Test: `src/core/color/domain.test.ts`

**Interfaces:**
- Consumes: `ScaleMode` from `@/core/types`
- Produces: `createColorDomain(values: readonly number[], mode: ScaleMode): ColorDomain`, where

```ts
interface ColorDomain {
  readonly mode: ScaleMode;
  readonly min: number;
  readonly max: number;
  /** Sorted ascending, deduplicated. Empty for non-quantile modes. */
  readonly sorted: readonly number[];
  /** Maps a value to a position in [0, 1]. Always clamped. */
  toT(value: number): number;
}
```

The default is `quantile` because Turkish crime counts are extremely right-skewed — İstanbul dwarfs everything, and a linear domain would render 78 provinces in indistinguishable blue.

- [ ] **Step 1: Write the failing tests**

Create `src/core/color/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createColorDomain } from './domain.js';

describe('createColorDomain — linear', () => {
  const domain = createColorDomain([0, 50, 100], 'linear');

  it('maps min to 0 and max to 1', () => {
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(100)).toBe(1);
  });

  it('maps the midpoint to 0.5', () => {
    expect(domain.toT(50)).toBeCloseTo(0.5, 6);
  });

  it('clamps values outside the observed range', () => {
    expect(domain.toT(-10)).toBe(0);
    expect(domain.toT(1000)).toBe(1);
  });

  it('exposes the observed min and max', () => {
    expect(domain.min).toBe(0);
    expect(domain.max).toBe(100);
  });
});

describe('createColorDomain — log', () => {
  const domain = createColorDomain([0, 10, 100, 10000], 'log');

  it('maps min to 0 and max to 1', () => {
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(10000)).toBe(1);
  });

  it('lifts small values well above their linear position', () => {
    // 100 of 10000 is t=0.01 linearly; log should place it far higher.
    expect(domain.toT(100)).toBeGreaterThan(0.4);
  });

  it('increases monotonically', () => {
    const ts = [0, 10, 100, 1000, 10000].map((v) => domain.toT(v));
    for (let i = 1; i < ts.length; i += 1) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });
});

describe('createColorDomain — quantile', () => {
  it('spreads a skewed distribution across the full range', () => {
    // One huge outlier and many small values: linear would flatten the small
    // ones to near-zero; quantile must separate them.
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    const domain = createColorDomain(values, 'quantile');

    const linear = createColorDomain(values, 'linear');
    expect(linear.toT(5)).toBeLessThan(0.01);
    expect(domain.toT(5)).toBeGreaterThan(0.3);
  });

  it('maps the smallest value to 0 and the largest to 1', () => {
    const domain = createColorDomain([5, 10, 20, 40], 'quantile');
    expect(domain.toT(5)).toBe(0);
    expect(domain.toT(40)).toBe(1);
  });

  it('increases monotonically across the sorted values', () => {
    const domain = createColorDomain([3, 1, 4, 1, 5, 9, 2, 6], 'quantile');
    const ts = [1, 2, 3, 4, 5, 6, 9].map((v) => domain.toT(v));
    for (let i = 1; i < ts.length; i += 1) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('deduplicates ties so repeated values share one position', () => {
    const domain = createColorDomain([1, 1, 1, 1, 100], 'quantile');
    expect(domain.sorted).toEqual([1, 100]);
    expect(domain.toT(1)).toBe(0);
    expect(domain.toT(100)).toBe(1);
  });

  it('interpolates values falling between observed values', () => {
    const domain = createColorDomain([0, 10, 20, 30, 40], 'quantile');
    const t = domain.toT(15);
    expect(t).toBeGreaterThan(domain.toT(10));
    expect(t).toBeLessThan(domain.toT(20));
  });

  it('clamps outside the observed range', () => {
    const domain = createColorDomain([10, 20], 'quantile');
    expect(domain.toT(0)).toBe(0);
    expect(domain.toT(99)).toBe(1);
  });
});

describe('createColorDomain — degenerate inputs', () => {
  it('returns a mid-position for every value when all values are equal', () => {
    // With no spread there is no meaningful ranking, so a neutral mid-tone is
    // the honest rendering. Returning 0 would falsely imply "lowest".
    for (const mode of ['linear', 'log', 'quantile'] as const) {
      const domain = createColorDomain([7, 7, 7], mode);
      expect(domain.toT(7)).toBe(0.5);
      expect(domain.toT(0)).toBe(0.5);
      expect(domain.min).toBe(7);
      expect(domain.max).toBe(7);
    }
  });

  it('handles a single value', () => {
    const domain = createColorDomain([42], 'quantile');
    expect(domain.toT(42)).toBe(0.5);
  });

  it('handles an empty value list without throwing', () => {
    for (const mode of ['linear', 'log', 'quantile'] as const) {
      const domain = createColorDomain([], mode);
      expect(domain.min).toBe(0);
      expect(domain.max).toBe(0);
      expect(domain.toT(5)).toBe(0.5);
    }
  });

  it('ignores non-finite values', () => {
    const domain = createColorDomain([1, Number.NaN, 10, Number.POSITIVE_INFINITY], 'linear');
    expect(domain.min).toBe(1);
    expect(domain.max).toBe(10);
  });

  it('returns a mid-position for a non-finite lookup', () => {
    const domain = createColorDomain([1, 10], 'linear');
    expect(domain.toT(Number.NaN)).toBe(0.5);
  });

  it('shifts negative values into the log domain rather than failing', () => {
    const domain = createColorDomain([-50, 0, 50], 'log');
    expect(domain.toT(-50)).toBe(0);
    expect(domain.toT(50)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/color/domain.test.ts`
Expected: FAIL — cannot resolve `./domain.js`.

- [ ] **Step 3: Implement `src/core/color/domain.ts`**

```ts
import type { ScaleMode } from '@/core/types/index.js';

export interface ColorDomain {
  readonly mode: ScaleMode;
  readonly min: number;
  readonly max: number;
  /** Ascending, deduplicated observed values. Populated only for quantile mode. */
  readonly sorted: readonly number[];
  /** Maps a value to [0, 1]. Always clamped; never returns NaN. */
  toT(value: number): number;
}

/** Position used when a value carries no ranking information. */
const NEUTRAL_T = 0.5;

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Index of the first element strictly greater than `target`.
 * Standard upper-bound binary search; O(log n) per lookup, which matters
 * because this runs once per region on every filter change.
 */
function upperBound(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid]! <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Builds a value→position mapping for a color ramp.
 *
 * - `linear`  — position is proportional to magnitude. Answers "how many".
 * - `log`     — compresses the top of a skewed range. Compromise between the two.
 * - `quantile`— position is proportional to rank. Answers "how does this compare".
 *
 * Quantile is the library default because Turkish crime counts are dominated by
 * a handful of metropolitan provinces; under a linear domain the other ~78 would
 * be visually identical.
 */
export function createColorDomain(
  values: readonly number[],
  mode: ScaleMode,
): ColorDomain {
  const finite = values.filter((v) => Number.isFinite(v));

  if (finite.length === 0) {
    return { mode, min: 0, max: 0, sorted: [], toT: () => NEUTRAL_T };
  }

  let min = finite[0]!;
  let max = finite[0]!;
  for (const value of finite) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  // No spread means no ranking. A neutral mid-tone is honest; 0 would falsely
  // read as "lowest in the country".
  if (min === max) {
    return { mode, min, max, sorted: [min], toT: () => NEUTRAL_T };
  }

  if (mode === 'quantile') {
    const sorted = [...new Set(finite)].sort((a, b) => a - b);
    const lastIndex = sorted.length - 1;

    return {
      mode, min, max, sorted,
      toT(value: number): number {
        if (!Number.isFinite(value)) return NEUTRAL_T;
        if (value <= min) return 0;
        if (value >= max) return 1;

        const upper = upperBound(sorted, value);
        const lowerIndex = upper - 1;
        const lowerValue = sorted[lowerIndex]!;

        // Exact hit on an observed value: its rank position.
        if (lowerValue === value) return lowerIndex / lastIndex;

        // Between two observed values: interpolate within that rank interval so
        // the mapping stays strictly monotonic.
        const upperValue = sorted[upper]!;
        const withinInterval = (value - lowerValue) / (upperValue - lowerValue);
        return (lowerIndex + withinInterval) / lastIndex;
      },
    };
  }

  if (mode === 'log') {
    // log1p needs a non-negative argument, so shift the whole domain to start at 0.
    const span = Math.log1p(max - min);
    return {
      mode, min, max, sorted: [],
      toT(value: number): number {
        if (!Number.isFinite(value)) return NEUTRAL_T;
        return clamp01(Math.log1p(Math.max(0, value - min)) / span);
      },
    };
  }

  const span = max - min;
  return {
    mode, min, max, sorted: [],
    toT(value: number): number {
      if (!Number.isFinite(value)) return NEUTRAL_T;
      return clamp01((value - min) / span);
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/color/domain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/color/domain.ts src/core/color/domain.test.ts
git commit -m "feat(core): add linear, log and quantile color domains"
```

---

## Task 8: Named color scales

**Files:**
- Create: `src/core/color/scales.ts`
- Test: `src/core/color/scales.test.ts`

**Interfaces:**
- Consumes: `createRamp` (Task 6), `createColorDomain` / `ColorDomain` (Task 7), `ScaleMode`
- Produces:
  - `SPECTRAL_STOPS`, `BLUE_RED_STOPS`, `DIFF_STOPS: readonly string[]`
  - `RAMPS: Record<'spectral' | 'blueRed', (t: number) => string>`
  - `type ColorScaleName = 'spectral' | 'blueRed'`
  - `type RampFn = (t: number) => string`
  - `createColorScale(options: ColorScaleOptions): ColorScale`
  - `createDiffColorScale(maxAbsDelta: number): ColorScale`

```ts
interface ColorScaleOptions {
  values: readonly number[];
  mode: ScaleMode;
  ramp: ColorScaleName | RampFn;
}
interface ColorScale {
  readonly domain: ColorDomain;
  readonly ramp: RampFn;
  /** value → hex color */
  (value: number): string;
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/core/color/scales.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseHex, rgbToOklab } from './interpolate.js';
import {
  BLUE_RED_STOPS, DIFF_STOPS, SPECTRAL_STOPS,
  createColorScale, createDiffColorScale,
} from './scales.js';

function hue(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.atan2(lab.b, lab.a);
}
function chroma(hex: string): number {
  const lab = rgbToOklab(parseHex(hex)!);
  return Math.hypot(lab.a, lab.b);
}

describe('stop definitions', () => {
  it('defines spectral from blue to red', () => {
    expect(SPECTRAL_STOPS.length).toBeGreaterThanOrEqual(5);
    expect(SPECTRAL_STOPS[0]).toMatch(/^#[\da-f]{6}$/u);
    expect(SPECTRAL_STOPS.at(-1)).toMatch(/^#[\da-f]{6}$/u);
  });

  it('gives every stop a valid hex value', () => {
    for (const stops of [SPECTRAL_STOPS, BLUE_RED_STOPS, DIFF_STOPS]) {
      for (const stop of stops) expect(parseHex(stop)).not.toBeNull();
    }
  });

  it('puts a near-neutral color at the center of the diverging diff ramp', () => {
    const middle = DIFF_STOPS[Math.floor(DIFF_STOPS.length / 2)]!;
    expect(chroma(middle)).toBeLessThan(0.05);
  });
});

describe('createColorScale', () => {
  const values = [0, 25, 50, 75, 100];

  it('maps the lowest value to the cool end and the highest to the warm end', () => {
    const scale = createColorScale({ values, mode: 'linear', ramp: 'spectral' });
    const low = scale(0);
    const high = scale(100);
    expect(low).toBe(SPECTRAL_STOPS[0]);
    expect(high).toBe(SPECTRAL_STOPS.at(-1));
    expect(hue(low)).not.toBeCloseTo(hue(high), 1);
  });

  it('exposes the underlying domain', () => {
    const scale = createColorScale({ values, mode: 'quantile', ramp: 'spectral' });
    expect(scale.domain.mode).toBe('quantile');
    expect(scale.domain.min).toBe(0);
    expect(scale.domain.max).toBe(100);
  });

  it('accepts a custom ramp function', () => {
    const scale = createColorScale({
      values, mode: 'linear',
      ramp: (t) => (t < 0.5 ? '#000000' : '#ffffff'),
    });
    expect(scale(0)).toBe('#000000');
    expect(scale(100)).toBe('#ffffff');
  });

  it('produces distinct colors across a skewed distribution in quantile mode', () => {
    const skewed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 5000];
    const scale = createColorScale({ values: skewed, mode: 'quantile', ramp: 'spectral' });
    const colors = skewed.map((v) => scale(v));
    expect(new Set(colors).size).toBeGreaterThanOrEqual(9);
  });

  it('returns a stable mid color when every value is identical', () => {
    const scale = createColorScale({ values: [4, 4, 4], mode: 'linear', ramp: 'spectral' });
    expect(scale(4)).toBe(scale(4));
    expect(parseHex(scale(4))).not.toBeNull();
  });

  it('returns a valid color for an empty dataset', () => {
    const scale = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    expect(parseHex(scale(0))).not.toBeNull();
  });
});

describe('createDiffColorScale', () => {
  const scale = createDiffColorScale(100);

  it('is symmetric around zero', () => {
    expect(scale.domain.min).toBe(-100);
    expect(scale.domain.max).toBe(100);
  });

  it('renders zero as the near-neutral center color', () => {
    expect(chroma(scale(0))).toBeLessThan(0.05);
  });

  it('renders increases and decreases as opposite hues', () => {
    const increase = scale(100);
    const decrease = scale(-100);
    expect(Math.abs(hue(increase) - hue(decrease))).toBeGreaterThan(1);
  });

  it('clamps deltas beyond the stated maximum', () => {
    expect(scale(500)).toBe(scale(100));
    expect(scale(-500)).toBe(scale(-100));
  });

  it('treats a zero maximum as an all-neutral scale', () => {
    const flat = createDiffColorScale(0);
    expect(chroma(flat(0))).toBeLessThan(0.05);
    expect(flat(10)).toBe(flat(0));
  });

  it('uses the absolute value of a negative maximum', () => {
    const negative = createDiffColorScale(-100);
    expect(negative.domain.min).toBe(-100);
    expect(negative.domain.max).toBe(100);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/color/scales.test.ts`
Expected: FAIL — cannot resolve `./scales.js`.

- [ ] **Step 3: Implement `src/core/color/scales.ts`**

```ts
import type { ScaleMode } from '@/core/types/index.js';
import { type ColorDomain, createColorDomain } from './domain.js';
import { createRamp } from './interpolate.js';

export type RampFn = (t: number) => string;
export type ColorScaleName = 'spectral' | 'blueRed';

/**
 * Default heat ramp: cool for low crime counts, warm for high.
 * Matches the reference design. Note that rainbow ramps are not fully
 * colorblind-safe, which is why the UI always shows numbers alongside color.
 */
export const SPECTRAL_STOPS: readonly string[] = [
  '#2b4bd8', // koyu mavi   — en düşük
  '#2e8fd4',
  '#3fbfae',
  '#8ed44f',
  '#e8d13a',
  '#ef8c31',
  '#d93a2b', // koyu kırmızı — en yüksek
];

/** Colorblind-friendlier alternative: no green, relies on the blue↔red axis. */
export const BLUE_RED_STOPS: readonly string[] = [
  '#2166ac',
  '#67a9cf',
  '#d1e5f0',
  '#f7f7f7',
  '#fddbc7',
  '#ef8a62',
  '#b2182b',
];

/** Diverging ramp for compare mode: blue = decrease, neutral = unchanged, red = increase. */
export const DIFF_STOPS: readonly string[] = [
  '#2166ac',
  '#7fb1d6',
  '#d6e6f0',
  '#f2f2f2', // merkez — değişim yok
  '#f7ddd0',
  '#e0866a',
  '#b2182b',
];

export const RAMPS: Readonly<Record<ColorScaleName, RampFn>> = {
  spectral: createRamp(SPECTRAL_STOPS),
  blueRed: createRamp(BLUE_RED_STOPS),
};

const DIFF_RAMP: RampFn = createRamp(DIFF_STOPS);

export interface ColorScale {
  (value: number): string;
  readonly domain: ColorDomain;
  readonly ramp: RampFn;
}

export interface ColorScaleOptions {
  values: readonly number[];
  mode: ScaleMode;
  ramp: ColorScaleName | RampFn;
}

function attach(domain: ColorDomain, ramp: RampFn): ColorScale {
  const scale = ((value: number) => ramp(domain.toT(value))) as ColorScale;
  return Object.assign(scale, { domain, ramp });
}

/** Builds a value→color scale from observed values, a domain mode, and a ramp. */
export function createColorScale(options: ColorScaleOptions): ColorScale {
  const ramp = typeof options.ramp === 'function' ? options.ramp : RAMPS[options.ramp];
  return attach(createColorDomain(options.values, options.mode), ramp);
}

/**
 * Builds the symmetric diverging scale used in compare mode.
 *
 * The domain is forced to [-max, +max] so that zero always lands on the neutral
 * center color. An asymmetric domain would put the neutral color at a nonzero
 * delta, which would make "no change" appear as a change.
 */
export function createDiffColorScale(maxAbsDelta: number): ColorScale {
  const bound = Math.abs(maxAbsDelta);
  const domain = createColorDomain([-bound, 0, bound], 'linear');
  return attach(domain, DIFF_RAMP);
}
```

Note the degenerate case: `createDiffColorScale(0)` builds a domain over `[0, 0, 0]`, which `createColorDomain` recognizes as having no spread and maps every value to `t = 0.5` — the neutral center. That is exactly right, and it is why the test asserting `flat(10) === flat(0)` passes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/color`
Expected: PASS, all color tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/color/scales.ts src/core/color/scales.test.ts
git commit -m "feat(core): add spectral, blueRed and diverging diff color scales"
```

---

## Task 9: Legend breaks

**Files:**
- Create: `src/core/color/legend.ts`, `src/core/color/index.ts`
- Test: `src/core/color/legend.test.ts`

**Interfaces:**
- Consumes: `ColorScale` (Task 8), `ColorDomain` (Task 7), `formatTrNumber` / `formatCompactTr` (Task 4)
- Produces: `computeLegendBreaks(scale: ColorScale, count: number): LegendBreak[]`, and the `src/core/color` barrel

```ts
interface LegendBreak {
  /** Lower bound of the bucket, inclusive. */
  from: number;
  /** Upper bound, inclusive for the last bucket, exclusive otherwise. */
  to: number;
  color: string;
  /** Pre-formatted Turkish label, e.g. "1.000 – 2.499". */
  label: string;
}
```

The legend must state which scale mode is active, because a quantile map answers "how does this rank" while a linear map answers "how many", and conflating them is a real analytical error. The mode label itself lives in `i18n/tr.ts` (Phase 3); this task supplies the numeric buckets.

- [ ] **Step 1: Write the failing tests**

Create `src/core/color/legend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLegendBreaks } from './legend.js';
import { createColorScale, createDiffColorScale } from './scales.js';

describe('computeLegendBreaks', () => {
  const scale = createColorScale({
    values: [0, 100, 200, 300, 400, 500],
    mode: 'linear',
    ramp: 'spectral',
  });

  it('returns the requested number of buckets', () => {
    expect(computeLegendBreaks(scale, 5)).toHaveLength(5);
    expect(computeLegendBreaks(scale, 3)).toHaveLength(3);
  });

  it('spans the whole domain with no gaps between buckets', () => {
    const breaks = computeLegendBreaks(scale, 5);
    expect(breaks[0]!.from).toBe(scale.domain.min);
    expect(breaks.at(-1)!.to).toBe(scale.domain.max);
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]!.from).toBe(breaks[i - 1]!.to);
    }
  });

  it('orders buckets from lowest to highest', () => {
    const breaks = computeLegendBreaks(scale, 5);
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]!.from).toBeGreaterThan(breaks[i - 1]!.from);
    }
  });

  it('gives each bucket the color of its own midpoint', () => {
    const breaks = computeLegendBreaks(scale, 5);
    for (const bucket of breaks) {
      expect(bucket.color).toBe(scale((bucket.from + bucket.to) / 2));
    }
  });

  it('formats labels in Turkish with an en dash', () => {
    const breaks = computeLegendBreaks(scale, 5);
    expect(breaks[0]!.label).toMatch(/^0\s–\s/u);
    expect(breaks.at(-1)!.label).toContain('500');
  });

  it('follows the quantile domain rather than even value steps', () => {
    // With a heavy outlier, quantile buckets must not be evenly spaced in value.
    const skewed = createColorScale({
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 5000],
      mode: 'quantile',
      ramp: 'spectral',
    });
    const breaks = computeLegendBreaks(skewed, 5);
    const widths = breaks.map((b) => b.to - b.from);
    const first = widths[0]!;
    expect(widths.some((w) => Math.abs(w - first) > 1)).toBe(true);
  });

  it('produces a single neutral bucket when every value is identical', () => {
    const flat = createColorScale({ values: [7, 7, 7], mode: 'linear', ramp: 'spectral' });
    const breaks = computeLegendBreaks(flat, 5);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]!.from).toBe(7);
    expect(breaks[0]!.to).toBe(7);
    expect(breaks[0]!.label).toBe('7');
  });

  it('produces a single bucket for an empty dataset', () => {
    const empty = createColorScale({ values: [], mode: 'quantile', ramp: 'spectral' });
    expect(computeLegendBreaks(empty, 5)).toHaveLength(1);
  });

  it('clamps a nonsensical bucket count into range', () => {
    expect(computeLegendBreaks(scale, 0)).toHaveLength(1);
    expect(computeLegendBreaks(scale, -3)).toHaveLength(1);
    expect(computeLegendBreaks(scale, 99).length).toBeLessThanOrEqual(12);
  });

  it('renders a symmetric signed legend for the diff scale', () => {
    const diff = createDiffColorScale(200);
    const breaks = computeLegendBreaks(diff, 5);
    expect(breaks[0]!.from).toBe(-200);
    expect(breaks.at(-1)!.to).toBe(200);
    expect(breaks[0]!.label).toContain('−');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/color/legend.test.ts`
Expected: FAIL — cannot resolve `./legend.js`.

- [ ] **Step 3: Implement `src/core/color/legend.ts`**

```ts
import { formatTrNumber } from '@/core/format/index.js';
import type { ColorScale } from './scales.js';

export interface LegendBreak {
  from: number;
  to: number;
  color: string;
  /** Pre-formatted Turkish label. */
  label: string;
}

const MIN_BUCKETS = 1;
const MAX_BUCKETS = 12;
/** U+2013 EN DASH, the correct connector for a numeric range. */
const RANGE_DASH = '–';

function clampBucketCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_BUCKETS;
  return Math.min(MAX_BUCKETS, Math.max(MIN_BUCKETS, Math.floor(count)));
}

/**
 * Splits a color scale into labelled legend buckets.
 *
 * Boundaries are derived by inverting the scale's own `t` positions rather than
 * by slicing the value range evenly. That matters for quantile domains: even
 * value steps would misrepresent where the color actually changes, and the
 * legend would not describe the map it sits next to.
 */
export function computeLegendBreaks(scale: ColorScale, count: number): LegendBreak[] {
  const { domain } = scale;
  const { min, max } = domain;

  if (min === max) {
    return [{
      from: min, to: max,
      color: scale(min),
      label: formatTrNumber(min),
    }];
  }

  const buckets = clampBucketCount(count);
  const boundaries: number[] = [min];

  for (let i = 1; i < buckets; i += 1) {
    boundaries.push(invertT(domain, i / buckets, min, max));
  }
  boundaries.push(max);

  const breaks: LegendBreak[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = boundaries[i]!;
    const to = boundaries[i + 1]!;
    breaks.push({
      from, to,
      color: scale((from + to) / 2),
      label: `${formatTrNumber(from)} ${RANGE_DASH} ${formatTrNumber(to)}`,
    });
  }

  return breaks;
}

/**
 * Finds the value whose position is `targetT`.
 *
 * Bisection rather than a closed-form inverse: `ColorDomain.toT` is monotonic but
 * not analytically invertible in quantile mode, and 40 iterations converge well
 * below the precision the legend displays. This runs a handful of times per
 * legend render, so the cost is irrelevant.
 */
function invertT(
  domain: { toT(value: number): number },
  targetT: number,
  min: number,
  max: number,
): number {
  let low = min;
  let high = max;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (domain.toT(mid) < targetT) low = mid;
    else high = mid;
  }
  return Math.round((low + high) / 2);
}
```

- [ ] **Step 4: Create the barrel `src/core/color/index.ts`**

```ts
export type { Oklab, RGB } from './interpolate.js';
export {
  createRamp, interpolateOklab, oklabToRgb, parseHex, rgbToOklab, toHex,
} from './interpolate.js';
export type { ColorDomain } from './domain.js';
export { createColorDomain } from './domain.js';
export type { ColorScale, ColorScaleName, ColorScaleOptions, RampFn } from './scales.js';
export {
  BLUE_RED_STOPS, DIFF_STOPS, RAMPS, SPECTRAL_STOPS,
  createColorScale, createDiffColorScale,
} from './scales.js';
export type { LegendBreak } from './legend.js';
export { computeLegendBreaks } from './legend.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/color`
Expected: PASS.

If the "no gaps" test fails on a quantile domain, the bisection is converging to a value whose `toT` sits just off the target; confirm `invertT` rounds only at the end, never inside the loop.

- [ ] **Step 6: Run the whole suite and check coverage so far**

Run: `npm run test:coverage`
Expected: PASS with 100% branch coverage across `src/core`. Coverage gaps at this point are almost always an untested guard clause — add the case rather than lowering the threshold.

- [ ] **Step 7: Commit**

```bash
git add src/core/color
git commit -m "feat(core): add legend break computation and color module barrel"
```

---

## Remaining tasks

Tasks 10–23 continue in a second document to keep each plan file readable and reviewable:

- **Task 10:** Aggregation index — validation, normalization, warning collection
- **Task 11:** Rollup — filtered per-region totals, by category and by year
- **Task 12:** Rank — sidebar ordering and share-of-total
- **Task 13:** Diff — A-vs-B deltas for compare mode
- **Task 14:** Seeded PRNG and mock data generator
- **Task 15:** Aggregation barrel and a realistic-scale performance test
- **Task 16:** Geo projection
- **Task 17:** TopoJSON decode and ilçe metadata derivation
- **Task 18:** Geo bounds — bbox, centroid, fit-to-region transform
- **Task 19:** Viewport culling
- **Task 20:** Search entity index
- **Task 21:** Search matching and scoring
- **Task 22:** `scripts/build-geo.ts`
- **Task 23:** Public barrel, build verification, README

See `2026-08-01-phase-1-foundation-part-2.md`.
