import { describe, expect, it } from 'vitest';
import { IL_BY_CODE, ilCodeFromIlceCode } from './region-meta.js';
import {
  LEVEL_HYSTERESIS, LEVEL_THRESHOLD, LEVELS,
  getLevelFeatures, getLevelRegionMeta,
} from './topology.js';

describe('bundled geography', () => {
  it('exposes both levels', () => {
    expect(LEVELS).toEqual(['il', 'ilce']);
  });

  it('decodes 81 provinces', () => {
    expect(getLevelFeatures('il').features).toHaveLength(81);
  });

  it('decodes 973 districts', () => {
    expect(getLevelFeatures('ilce').features).toHaveLength(973);
  });

  it('returns a referentially stable collection so useMemo can skip re-decoding', () => {
    expect(getLevelFeatures('il')).toBe(getLevelFeatures('il'));
  });

  it('gives every province feature a valid plaka code', () => {
    for (const feature of getLevelFeatures('il').features) {
      expect(IL_BY_CODE.has(String(feature.id))).toBe(true);
    }
  });

  it('gives every district feature a code whose parent is a real province', () => {
    for (const feature of getLevelFeatures('ilce').features) {
      expect(ilCodeFromIlceCode(String(feature.id))).not.toBeNull();
    }
  });

  it('names every region', () => {
    for (const level of LEVELS) {
      for (const [, meta] of getLevelRegionMeta(level)) {
        expect(meta.name).not.toBe('');
      }
    }
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
