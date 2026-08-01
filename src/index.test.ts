import { describe, expect, it } from 'vitest';
import * as api from './index.js';

describe('public API surface', () => {
  it('exports the aggregation pipeline', () => {
    for (const name of ['buildIndex', 'rollup', 'rankRegions', 'diffRollups'] as const) {
      expect(typeof api[name]).toBe('function');
    }
  });

  it('exports the color system', () => {
    for (const name of ['createColorScale', 'createDiffColorScale', 'computeLegendBreaks'] as const) {
      expect(typeof api[name]).toBe('function');
    }
    expect(Array.isArray(api.EMBER_STOPS)).toBe(true);
  });

  it('exports the search utilities', () => {
    for (const name of ['foldTurkish', 'compareTurkish', 'buildSearchIndex', 'searchEntities'] as const) {
      expect(typeof api[name]).toBe('function');
    }
  });

  it('exports the formatters', () => {
    for (const name of ['formatTrNumber', 'formatCompactTr', 'formatPercent', 'formatDelta'] as const) {
      expect(typeof api[name]).toBe('function');
    }
  });

  it('exports the geo utilities', () => {
    for (const name of [
      'createTurkeyProjection', 'decodeTopology', 'computeFitTransform', 'cullFeatures',
    ] as const) {
      expect(typeof api[name]).toBe('function');
    }
  });

  it('exports region metadata and the mock generator', () => {
    expect(api.IL_REGIONS).toHaveLength(81);
    expect(typeof api.generateMockData).toBe('function');
    expect(api.MOCK_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('produces a dataset the pipeline accepts end to end', () => {
    // The integration check for Phase 1: generate, validate, roll up, rank,
    // color, and legend without a single React import in the path.
    const { records, categories } = api.generateMockData({ years: [2023] });
    const index = api.buildIndex({ data: records, categories });
    expect(index.warnings).toEqual([]);

    const result = api.rollup(index, 'il', { yearRange: [2023, 2023], categories: [] });
    expect(result.byRegion.size).toBe(81);

    const names = new Map(api.IL_REGIONS.map((r) => [r.code, r.name]));
    const ranked = api.rankRegions(result, { sort: 'total-desc', names });
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[0]!.code).toBe('34');

    const scale = api.createColorScale({
      values: result.values, mode: 'quantile', ramp: 'ember',
    });
    expect(api.parseHex(scale(ranked[0]!.total))).not.toBeNull();
    expect(api.computeLegendBreaks(scale, 5)).toHaveLength(5);
  });

  it('drives compare mode end to end', () => {
    const { records, categories } = api.generateMockData({ years: [2022, 2023] });
    const index = api.buildIndex({ data: records, categories });

    const a = api.rollup(index, 'il', { yearRange: [2023, 2023], categories: [] });
    const b = api.rollup(index, 'il', { yearRange: [2022, 2022], categories: [] });
    const diff = api.diffRollups(a, b);

    expect(diff.byRegion.size).toBe(81);
    const scale = api.createDiffColorScale(diff.maxAbsDelta);
    expect(api.parseHex(scale(diff.byRegion.get('34')!.delta))).not.toBeNull();
  });

  it('drives Turkish search end to end against real province names', () => {
    const searchIndex = api.buildSearchIndex({
      ilRegions: api.IL_REGIONS,
      ilceRegions: [],
      categories: [...api.MOCK_CATEGORIES],
      years: [2023],
      ilNames: new Map(api.IL_REGIONS.map((r) => [r.code, r.name])),
    });

    expect(api.searchEntities(searchIndex, 'istanbul')[0]?.entity.id).toBe('34');
    expect(api.searchEntities(searchIndex, 'sanliurfa')[0]?.entity.id).toBe('63');
    expect(api.searchEntities(searchIndex, 'gumushane')[0]?.entity.id).toBe('29');
  });
});

describe('Phase 2 public surface', () => {
  it('exports the component', async () => {
    const api = await import('./index.js');
    expect(typeof api.CrimeHeatMap).toBe('function');
  });

  it('exports the Turkish string table and its merger', async () => {
    const api = await import('./index.js');
    expect(api.trStrings.level.il).toBe('İl');
    expect(typeof api.mergeStrings).toBe('function');
  });

  it('exports the bundled geography', async () => {
    const api = await import('./index.js');
    expect(api.getLevelFeatures('il').features).toHaveLength(81);
    expect(api.getLevelFeatures('ilce').features).toHaveLength(973);
  });
});

describe('Phase 3 public surface', () => {
  it('exports the validated categorical palette', async () => {
    const api = await import('./index.js');
    expect(api.CATEGORY_PALETTE).toHaveLength(8);
    expect(api.categoryColor(0)).toBe(api.CATEGORY_PALETTE[0]);
  });

  it('exports the chart geometry helpers', async () => {
    const api = await import('./index.js');
    expect(typeof api.arcPath).toBe('function');
    expect(typeof api.linePath).toBe('function');
    expect(api.niceMax(87)).toBe(100);
  });

  it('exports the per-capita helpers', async () => {
    const api = await import('./index.js');
    expect(typeof api.buildPopulationIndex).toBe('function');
    expect(typeof api.toPerCapita).toBe('function');
  });
});
