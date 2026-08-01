import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import {
  bboxOf, centroidOfRing, largestPolygon, pointInPolygons, pointInRing, polygonsOf,
  representativePoint, rewindGeometry, ringArea,
} from './planar.js';

/** Counter-clockwise unit square. */
const CCW: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
/** The same square, clockwise. */
const CW: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];

function polygon(rings: [number, number][][]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: rings },
  };
}

describe('ringArea', () => {
  it('is positive for a counter-clockwise ring and negative for a clockwise one', () => {
    expect(ringArea(CCW)).toBeCloseTo(1);
    expect(ringArea(CW)).toBeCloseTo(-1);
  });

  it('is zero for a degenerate ring', () => {
    expect(ringArea([[0, 0], [1, 1], [0, 0]])).toBe(0);
  });
});

describe('pointInRing', () => {
  it('accepts an interior point and rejects an exterior one', () => {
    expect(pointInRing([0.5, 0.5], CCW)).toBe(true);
    expect(pointInRing([1.5, 0.5], CCW)).toBe(false);
  });

  it('is unaffected by winding', () => {
    expect(pointInRing([0.5, 0.5], CW)).toBe(true);
  });
});

describe('pointInPolygons', () => {
  const withHole: [number, number][][] = [
    [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
    [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]],
  ];

  it('rejects a point inside a hole', () => {
    expect(pointInPolygons([2, 2], [withHole])).toBe(false);
  });

  it('accepts a point between the hole and the outer ring', () => {
    expect(pointInPolygons([0.5, 0.5], [withHole])).toBe(true);
  });

  it('rejects a point outside every polygon', () => {
    expect(pointInPolygons([9, 9], [withHole])).toBe(false);
  });

  it('searches every polygon of a multipolygon', () => {
    const far: [number, number][][] = [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]];
    expect(pointInPolygons([10.5, 10.5], [withHole, far])).toBe(true);
  });
});

describe('bboxOf', () => {
  it('spans every polygon', () => {
    const a: [number, number][][] = [CCW];
    const b: [number, number][][] = [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]];
    expect(bboxOf([a, b])).toEqual([0, 0, 6, 6]);
  });
});

describe('centroidOfRing', () => {
  it('finds the centre of a square', () => {
    const [x, y] = centroidOfRing(CCW);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it('falls back to the first vertex when the ring has no area', () => {
    expect(centroidOfRing([[7, 8], [7, 8], [7, 8]])).toEqual([7, 8]);
  });
});

describe('largestPolygon', () => {
  it('picks the polygon with the greatest area regardless of winding', () => {
    const small: [number, number][][] = [CW];
    const big: [number, number][][] = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
    expect(largestPolygon([small, big])).toBe(big);
  });

  it('throws on an empty geometry rather than returning a bad point', () => {
    expect(() => largestPolygon([])).toThrow(/Poligonsuz/u);
  });
});

describe('representativePoint', () => {
  it('uses the centroid when it lies inside', () => {
    const [x, y] = representativePoint([[CCW]]);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it('finds an interior point when the centroid falls outside the shape', () => {
    // A C-shape: its centroid sits in the open mouth, not in the polygon.
    const cShape: [number, number][] = [
      [0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10], [0, 0],
    ];
    expect(pointInRing(centroidOfRing(cShape), cShape)).toBe(false);

    const point = representativePoint([[cShape]]);
    expect(pointInRing(point, cShape)).toBe(true);
  });
});

describe('polygonsOf', () => {
  it('normalizes Polygon and MultiPolygon to the same shape', () => {
    expect(polygonsOf(polygon([CCW]))).toHaveLength(1);

    const multi: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [[CCW], [CW]] },
    };
    expect(polygonsOf(multi)).toHaveLength(2);
  });

  it('throws on a geometry it cannot area-test', () => {
    const point: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [0, 0] },
    };
    expect(() => polygonsOf(point)).toThrow(/Beklenmeyen geometri/u);
  });
});

describe('rewindGeometry', () => {
  it('makes exterior rings clockwise, which is what d3-geo requires', () => {
    const out = rewindGeometry(polygon([CCW]).geometry) as GeoJSON.Polygon;
    expect(ringArea(out.coordinates[0] as [number, number][])).toBeLessThan(0);
  });

  it('leaves an already-clockwise exterior ring untouched', () => {
    const out = rewindGeometry(polygon([CW]).geometry) as GeoJSON.Polygon;
    expect(out.coordinates[0]).toEqual(CW);
  });

  it('winds holes opposite to their exterior ring', () => {
    const out = rewindGeometry(polygon([CCW, CCW]).geometry) as GeoJSON.Polygon;
    expect(ringArea(out.coordinates[0] as [number, number][])).toBeLessThan(0);
    expect(ringArea(out.coordinates[1] as [number, number][])).toBeGreaterThan(0);
  });

  it('rewinds every polygon of a multipolygon', () => {
    const multi: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [[CCW], [CW]] };
    const out = rewindGeometry(multi) as GeoJSON.MultiPolygon;
    for (const poly of out.coordinates) {
      expect(ringArea(poly[0] as [number, number][])).toBeLessThan(0);
    }
  });

  it('passes non-area geometries through unchanged', () => {
    const point: GeoJSON.Point = { type: 'Point', coordinates: [1, 2] };
    expect(rewindGeometry(point)).toBe(point);
  });

  /**
   * The regression this whole function exists for: wound the wrong way, d3-geo
   * measures a small region as the entire sphere (4π ≈ 12.566 steradians), which
   * silently destroys fitExtent, geoBounds and geoContains.
   */
  it('produces a sane spherical area where the wrong winding yields the whole globe', () => {
    const square: [number, number][] = [[32, 39], [33, 39], [33, 40], [32, 40], [32, 39]];
    const wrong: GeoJSON.Polygon = { type: 'Polygon', coordinates: [square] };
    expect(geoArea(wrong)).toBeGreaterThan(12);

    const fixed = rewindGeometry(wrong) as GeoJSON.Polygon;
    expect(geoArea(fixed)).toBeLessThan(0.001);
    expect(geoArea(fixed)).toBeGreaterThan(0);
  });
});
