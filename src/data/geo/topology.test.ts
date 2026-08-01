import { describe, expect, it } from 'vitest';
import { IL_BY_CODE, ilCodeFromIlceCode } from '@/core/geo/index.js';
import {
  LEVEL_HYSTERESIS, LEVEL_THRESHOLD, LEVELS,
  getLevelRegionMeta, loadLevelFeatures, peekLevelFeatures,
} from './topology.js';

describe('bundled geography', () => {
  it('exposes both levels', () => {
    expect(LEVELS).toEqual(['il', 'ilce']);
  });

  it('has the 81 provinces from the start', () => {
    // The projection is fitted to them, so nothing can be drawn without them.
    expect(peekLevelFeatures('il')?.features).toHaveLength(81);
  });

  it('loads the 973 districts on request', async () => {
    expect((await loadLevelFeatures('ilce')).features).toHaveLength(973);
  });

  it('returns a referentially stable collection so useMemo can skip re-decoding', () => {
    expect(peekLevelFeatures('il')).toBe(peekLevelFeatures('il'));
  });

  it('keeps returning the same district collection once it has one', async () => {
    const first = await loadLevelFeatures('ilce');
    expect(await loadLevelFeatures('ilce')).toBe(first);
    expect(peekLevelFeatures('ilce')).toBe(first);
  });

  it('resolves provinces without a fetch, so one call site serves both levels', async () => {
    expect(await loadLevelFeatures('il')).toBe(peekLevelFeatures('il'));
  });

  it('gives every province feature a valid plaka code', () => {
    for (const feature of peekLevelFeatures('il')?.features ?? []) {
      expect(IL_BY_CODE.has(String(feature.id))).toBe(true);
    }
  });

  it('gives every district feature a code whose parent is a real province', async () => {
    for (const feature of (await loadLevelFeatures('ilce')).features) {
      expect(ilCodeFromIlceCode(String(feature.id))).not.toBeNull();
    }
  });
});

describe('region metadata is available without the geometry', () => {
  /**
   * The point of the split. Every district's code and name is wanted at mount —
   * to validate records, to build the search index, to label a tooltip — while
   * the 262 KB of arcs behind them are only wanted once the map draws district
   * boundaries. Deriving the metadata from the geometry would drag those arcs
   * back into the initial bundle through the side door.
   */
  it('names all 973 districts synchronously', () => {
    expect(getLevelRegionMeta('ilce').size).toBe(973);
  });

  it('names all 81 provinces synchronously', () => {
    expect(getLevelRegionMeta('il').size).toBe(81);
  });

  it('names every region', () => {
    for (const level of LEVELS) {
      for (const [, meta] of getLevelRegionMeta(level)) {
        expect(meta.name).not.toBe('');
      }
    }
  });

  it('names exactly the districts the geometry draws', async () => {
    // The two ship as separate files now, so nothing but this stops them
    // drifting apart the next time the geography is rebuilt.
    const drawn = (await loadLevelFeatures('ilce')).features
      .map((item) => String(item.id))
      .sort();
    expect([...getLevelRegionMeta('ilce').keys()].sort()).toEqual(drawn);
  });

  it('links every district to its parent province', () => {
    for (const [code, meta] of getLevelRegionMeta('ilce')) {
      expect(meta.parentCode).toBe(code.slice(0, 2));
    }
  });

  it('leaves provinces without a parent', () => {
    for (const [, meta] of getLevelRegionMeta('il')) {
      expect(meta.parentCode).toBeNull();
    }
  });

  it('keeps the hysteresis band inside the threshold', () => {
    expect(LEVEL_THRESHOLD).toBe(2.5);
    expect(LEVEL_HYSTERESIS).toBeGreaterThan(0);
    expect(LEVEL_HYSTERESIS).toBeLessThan(LEVEL_THRESHOLD);
  });
});
