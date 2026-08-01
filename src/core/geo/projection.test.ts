import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { createPathGenerator, createTurkeyProjection } from './projection.js';

/** A lon/lat square, used to compare geographic against projected area. */
function square(lon: number, lat: number, size = 2): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat],
      ]],
    },
  };
}

const TURKEY_BOX: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[26, 36], [45, 36], [45, 42], [26, 42], [26, 36]]],
    },
  }],
};

const VIEWPORT = { width: 800, height: 400 };

describe('createTurkeyProjection', () => {
  const projection = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });

  it('projects Turkish coordinates inside the viewport', () => {
    for (const [lon, lat] of [[28.98, 41.01], [32.85, 39.93], [27.14, 38.42], [39.22, 38.35]]) {
      const point = projection([lon!, lat!]);
      expect(point).not.toBeNull();
      expect(point![0]).toBeGreaterThanOrEqual(0);
      expect(point![0]).toBeLessThanOrEqual(VIEWPORT.width);
      expect(point![1]).toBeGreaterThanOrEqual(0);
      expect(point![1]).toBeLessThanOrEqual(VIEWPORT.height);
    }
  });

  it('places İstanbul north-west of Diyarbakır', () => {
    const istanbul = projection([28.98, 41.01])!;
    const diyarbakir = projection([40.23, 37.91])!;
    expect(istanbul[0]).toBeLessThan(diyarbakir[0]);   // further west
    expect(istanbul[1]).toBeLessThan(diyarbakir[1]);   // further north (smaller y)
  });

  it('preserves area ratios, which a choropleth depends on', () => {
    // Two equal-size lon/lat squares at different latitudes cover different
    // geographic areas. An equal-area projection must reproduce that ratio; a
    // Mercator projection would not.
    const path = createPathGenerator(projection);
    const south = square(30, 36);
    const north = square(30, 40);

    const geoRatio = geoArea(north) / geoArea(south);
    const pixelRatio = Math.abs(path.area(north)) / Math.abs(path.area(south));

    expect(pixelRatio).toBeCloseTo(geoRatio, 2);
  });

  it('fills the viewport, honoring padding on every side', () => {
    const path = createPathGenerator(projection);
    const [[minX, minY], [maxX, maxY]] = path.bounds(TURKEY_BOX);

    expect(minX).toBeGreaterThanOrEqual(-0.5);
    expect(minY).toBeGreaterThanOrEqual(-0.5);
    expect(maxX).toBeLessThanOrEqual(VIEWPORT.width + 0.5);
    expect(maxY).toBeLessThanOrEqual(VIEWPORT.height + 0.5);

    // At least one axis should be snug against its padding, or the fit is loose.
    const padding = 8;
    const snugX = Math.abs(minX - padding) < 1 || Math.abs(maxX - (VIEWPORT.width - padding)) < 1;
    const snugY = Math.abs(minY - padding) < 1 || Math.abs(maxY - (VIEWPORT.height - padding)) < 1;
    expect(snugX || snugY).toBe(true);
  });

  it('honors a custom padding', () => {
    const padded = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX, padding: 40 });
    const [[minX]] = createPathGenerator(padded).bounds(TURKEY_BOX);
    expect(minX).toBeGreaterThanOrEqual(39);
  });

  it('is deterministic for identical inputs', () => {
    const a = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });
    const b = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });
    expect(a([32, 39])).toEqual(b([32, 39]));
  });

  it('rescales when the viewport changes', () => {
    const wide = createTurkeyProjection({
      viewport: { width: 1600, height: 800 }, fitTo: TURKEY_BOX,
    });
    expect(wide.scale()).toBeGreaterThan(projection.scale());
  });

  it('does not throw on a degenerate viewport', () => {
    // A container measured before layout reports 0x0. The projection must
    // survive it; the component simply renders nothing until a real size arrives.
    expect(() => createTurkeyProjection({
      viewport: { width: 0, height: 0 }, fitTo: TURKEY_BOX,
    })).not.toThrow();
  });

  it('does not throw when padding exceeds the viewport', () => {
    expect(() => createTurkeyProjection({
      viewport: { width: 50, height: 50 }, fitTo: TURKEY_BOX, padding: 100,
    })).not.toThrow();
  });

  it('does not throw on an empty feature collection', () => {
    expect(() => createTurkeyProjection({
      viewport: VIEWPORT, fitTo: { type: 'FeatureCollection', features: [] },
    })).not.toThrow();
  });
});
