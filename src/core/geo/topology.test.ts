import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/sample.topo.json' with { type: 'json' };
import { decodeTopology, deriveRegionMeta, regionNameMap } from './topology.js';

const TOPOLOGY = sample as unknown as Topology;

describe('decodeTopology', () => {
  it('converts a named object into a GeoJSON FeatureCollection', () => {
    const collection = decodeTopology(TOPOLOGY, 'regions');
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(3);
  });

  it('preserves feature ids and names', () => {
    const [first] = decodeTopology(TOPOLOGY, 'regions').features;
    expect(first!.id).toBe('3401');
    expect(first!.properties?.['name']).toBe('Kadıköy');
  });

  it('produces valid polygon geometry', () => {
    for (const feature of decodeTopology(TOPOLOGY, 'regions').features) {
      expect(feature.geometry.type).toBe('Polygon');
    }
  });

  it('returns the identical object for repeated calls, so React can memoize on it', () => {
    // Decoding is the single most expensive geo operation. Referential stability
    // lets downstream useMemo hooks skip it entirely on re-render.
    expect(decodeTopology(TOPOLOGY, 'regions')).toBe(decodeTopology(TOPOLOGY, 'regions'));
  });

  it('caches per object name, not per topology', () => {
    expect(decodeTopology(TOPOLOGY, 'regions')).not.toBe(decodeTopology(TOPOLOGY, 'empty'));
  });

  it('returns an empty collection for an unknown object name', () => {
    const collection = decodeTopology(TOPOLOGY, 'yok');
    expect(collection.features).toEqual([]);
  });

  it('handles an object with no geometries', () => {
    expect(decodeTopology(TOPOLOGY, 'empty').features).toEqual([]);
  });

  it('caches independently per topology object', () => {
    const clone = JSON.parse(JSON.stringify(sample)) as Topology;
    expect(decodeTopology(clone, 'regions')).not.toBe(decodeTopology(TOPOLOGY, 'regions'));
    expect(decodeTopology(clone, 'regions')).toBe(decodeTopology(clone, 'regions'));
  });
});

describe('deriveRegionMeta', () => {
  const metas = deriveRegionMeta(decodeTopology(TOPOLOGY, 'regions'));

  it('derives one entry per feature', () => {
    expect(metas).toHaveLength(3);
  });

  it('reads code and name from the feature', () => {
    expect(metas[0]).toEqual({ code: '3401', name: 'Kadıköy', parentCode: '34' });
  });

  it('links each ilçe to its parent province', () => {
    expect(metas.map((m) => m.parentCode)).toEqual(['34', '34', '06']);
  });

  it('gives 2-digit il codes a null parent', () => {
    const ilCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '34', properties: { name: 'İstanbul' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(ilCollection)[0]).toEqual({
      code: '34', name: 'İstanbul', parentCode: null,
    });
  });

  it('skips features with no id rather than inventing one', () => {
    const broken: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: { name: 'Adsız' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(broken)).toEqual([]);
  });

  it('falls back to the code when a name is missing', () => {
    const unnamed: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: {},
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(unnamed)[0]!.name).toBe('3401');
  });

  it('falls back to the code when the name is an empty string', () => {
    const blank: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: { name: '' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(blank)[0]!.name).toBe('3401');
  });

  it('falls back to the code when the name is not a string', () => {
    const numericName: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: { name: 42 },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(numericName)[0]!.name).toBe('3401');
  });

  it('handles a null properties object', () => {
    const nullProps: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: null,
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(nullProps)[0]!.name).toBe('3401');
  });

  it('coerces a numeric id to a string', () => {
    const numeric: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: 3401, properties: { name: 'Kadıköy' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(numeric)[0]!.code).toBe('3401');
  });
});

describe('regionNameMap', () => {
  it('maps codes to names for the sidebar and tooltip', () => {
    const map = regionNameMap(deriveRegionMeta(decodeTopology(TOPOLOGY, 'regions')));
    expect(map.get('3401')).toBe('Kadıköy');
    expect(map.get('0601')).toBe('Çankaya');
    expect(map.size).toBe(3);
  });

  it('returns an empty map for empty input', () => {
    expect(regionNameMap([]).size).toBe(0);
  });
});
