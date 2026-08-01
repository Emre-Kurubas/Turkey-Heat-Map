import { describe, expect, it } from 'vitest';
import { validateFeatures } from './build-geo.js';

function feature(id: string | undefined, name = 'Bir Yer'): GeoJSON.Feature {
  return {
    type: 'Feature',
    ...(id === undefined ? {} : { id }),
    properties: { name },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  };
}

const allProvinces = (): GeoJSON.Feature[] =>
  Array.from({ length: 81 }, (_, i) => feature(String(i + 1).padStart(2, '0'), `İl ${i + 1}`));

describe('validateFeatures — il level', () => {
  it('accepts a complete province set', () => {
    const report = validateFeatures(allProvinces(), 'il');
    expect(report.ok).toBe(true);
    expect(report.missingCodes).toEqual([]);
    expect(report.unknownCodes).toEqual([]);
  });

  it('reports a missing province', () => {
    const incomplete = allProvinces().filter((f) => f.id !== '34');
    const report = validateFeatures(incomplete, 'il');
    expect(report.ok).toBe(false);
    expect(report.missingCodes).toContain('34');
  });

  it('reports a province code that is not real', () => {
    const report = validateFeatures([...allProvinces(), feature('99')], 'il');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('99');
  });

  it('reports duplicates', () => {
    const report = validateFeatures([...allProvinces(), feature('34')], 'il');
    expect(report.ok).toBe(false);
    expect(report.duplicateCodes).toContain('34');
  });

  it('reports features with no id', () => {
    const report = validateFeatures([...allProvinces(), feature(undefined)], 'il');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('(id yok)');
  });

  it('reports features with no name', () => {
    const missing = allProvinces();
    missing[0] = feature('01', '');
    const report = validateFeatures(missing, 'il');
    expect(report.ok).toBe(false);
    expect(report.unnamedCodes).toContain('01');
  });

  it('reports a non-string name', () => {
    const broken = allProvinces();
    broken[0] = {
      type: 'Feature', id: '01', properties: { name: 42 },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    };
    expect(validateFeatures(broken, 'il').unnamedCodes).toContain('01');
  });
});

describe('validateFeatures — ilçe level', () => {
  const coveringAllProvinces = (): GeoJSON.Feature[] =>
    Array.from({ length: 81 }, (_, i) =>
      feature(`${String(i + 1).padStart(2, '0')}01`, `İlçe ${i + 1}`));

  it('accepts full district coverage of every province', () => {
    const report = validateFeatures(coveringAllProvinces(), 'ilce');
    expect(report.ok).toBe(true);
    expect(report.provincesWithoutDistricts).toEqual([]);
  });

  it('does not require a complete district set, since the count is not fixed', () => {
    expect(validateFeatures(coveringAllProvinces(), 'ilce').missingCodes).toEqual([]);
  });

  it('reports a district whose parent province does not exist', () => {
    const report = validateFeatures([...coveringAllProvinces(), feature('9901')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('9901');
  });

  it('reports a malformed district code', () => {
    const report = validateFeatures([...coveringAllProvinces(), feature('340')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('340');
  });

  it('reports every province with no districts at all', () => {
    // A province with zero districts leaves a hole at ilçe zoom.
    const report = validateFeatures([feature('3401')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.missingCodes).toEqual([]);
    expect(report.unknownCodes).toEqual([]);
    expect(report.provincesWithoutDistricts).toContain('06');
    expect(report.provincesWithoutDistricts).not.toContain('34');
  });

  it('reports duplicate district codes', () => {
    const report = validateFeatures([...coveringAllProvinces(), feature('3401')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.duplicateCodes).toContain('3401');
  });
});

describe('validateFeatures — empty input', () => {
  it('rejects an empty il set', () => {
    const report = validateFeatures([], 'il');
    expect(report.ok).toBe(false);
    expect(report.missingCodes).toHaveLength(81);
  });

  it('rejects an empty ilçe set', () => {
    const report = validateFeatures([], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.provincesWithoutDistricts).toHaveLength(81);
  });
});
