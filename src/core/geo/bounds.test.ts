import { geoIdentity, geoPath } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { collectBounds, computeFitTransform, featureBounds, featureCentroid } from './bounds.js';

/** Identity projection: input coordinates are already pixels, so tests are readable. */
const PATH = geoPath(geoIdentity());

function box(id: string, x0: number, y0: number, x1: number, y1: number): GeoJSON.Feature {
  return {
    type: 'Feature', id, properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
    },
  };
}

const EMPTY_FEATURE: GeoJSON.Feature = {
  type: 'Feature', id: 'e', properties: {},
  geometry: { type: 'Polygon', coordinates: [] },
};

describe('featureBounds', () => {
  it('returns the projected bounding box', () => {
    expect(featureBounds(PATH, box('a', 10, 20, 110, 220)))
      .toEqual([[10, 20], [110, 220]]);
  });

  it('returns a degenerate box for empty geometry rather than Infinity', () => {
    expect(featureBounds(PATH, EMPTY_FEATURE)).toEqual([[0, 0], [0, 0]]);
  });
});

describe('collectBounds', () => {
  it('maps every feature id to its bounding box', () => {
    const bounds = collectBounds(PATH, {
      type: 'FeatureCollection',
      features: [box('a', 0, 0, 10, 10), box('b', 20, 20, 40, 40)],
    });
    expect(bounds.size).toBe(2);
    expect(bounds.get('b')).toEqual([[20, 20], [40, 40]]);
  });

  it('skips features with no id', () => {
    const anonymous = box('x', 0, 0, 1, 1);
    delete anonymous.id;
    expect(collectBounds(PATH, { type: 'FeatureCollection', features: [anonymous] }).size).toBe(0);
  });

  it('returns an empty map for an empty collection', () => {
    expect(collectBounds(PATH, { type: 'FeatureCollection', features: [] }).size).toBe(0);
  });
});

describe('featureCentroid', () => {
  it('returns the projected centroid', () => {
    const [x, y] = featureCentroid(PATH, box('a', 0, 0, 100, 100));
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(50, 5);
  });

  it('returns the origin for empty geometry rather than NaN', () => {
    expect(featureCentroid(PATH, EMPTY_FEATURE)).toEqual([0, 0]);
  });
});

describe('computeFitTransform', () => {
  const viewport = { width: 1000, height: 1000 };

  it('centers the region in the viewport', () => {
    const { k, x, y } = computeFitTransform([[400, 400], [600, 600]], viewport);
    // Region center (500, 500) must land at viewport center (500, 500).
    expect(500 * k + x).toBeCloseTo(500, 5);
    expect(500 * k + y).toBeCloseTo(500, 5);
  });

  it('scales the region to fill the viewport minus padding', () => {
    const { k } = computeFitTransform([[400, 400], [600, 600]], viewport, { padding: 100 });
    // 200px region into 800px of usable space.
    expect(k).toBeCloseTo(4, 5);
  });

  it('fits the more constrained axis so nothing is cropped', () => {
    const { k } = computeFitTransform([[0, 0], [500, 100]], viewport, { padding: 0 });
    expect(k).toBeCloseTo(2, 5); // width-limited: 1000/500, not 1000/100
  });

  it('fits the more constrained axis when height is the limit', () => {
    const { k } = computeFitTransform([[0, 0], [100, 500]], viewport, { padding: 0 });
    expect(k).toBeCloseTo(2, 5);
  });

  it('clamps to maxScale so a tiny district does not zoom absurdly', () => {
    const { k } = computeFitTransform([[500, 500], [501, 501]], viewport, { maxScale: 12 });
    expect(k).toBe(12);
  });

  it('clamps to minScale so a huge region does not zoom out past the country view', () => {
    const { k } = computeFitTransform([[0, 0], [5000, 5000]], viewport, { minScale: 1 });
    expect(k).toBe(1);
  });

  it('keeps the region centered even when the scale is clamped', () => {
    const { k, x, y } = computeFitTransform([[500, 500], [501, 501]], viewport, { maxScale: 12 });
    expect(500.5 * k + x).toBeCloseTo(500, 5);
    expect(500.5 * k + y).toBeCloseTo(500, 5);
  });

  it('handles a zero-area bbox without dividing by zero', () => {
    const { k, x, y } = computeFitTransform([[300, 300], [300, 300]], viewport);
    expect(Number.isFinite(k)).toBe(true);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(300 * k + x).toBeCloseTo(500, 5);
  });

  it('handles a zero-width but nonzero-height bbox', () => {
    const { k } = computeFitTransform([[300, 0], [300, 100]], viewport, { padding: 0 });
    expect(Number.isFinite(k)).toBe(true);
    expect(k).toBeCloseTo(10, 5);
  });

  it('handles a degenerate viewport without producing NaN', () => {
    const { k, x, y } = computeFitTransform([[0, 0], [100, 100]], { width: 0, height: 0 });
    expect(Number.isFinite(k)).toBe(true);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('produces a transform matching the SVG translate-then-scale convention', () => {
    // screen = point * k + [x, y], i.e. transform="translate(x,y) scale(k)".
    const bbox: [[number, number], [number, number]] = [[0, 0], [100, 100]];
    const { k, x } = computeFitTransform(bbox, viewport, { padding: 0 });
    expect(0 * k + x).toBeCloseTo(0, 5);
    expect(100 * k + x).toBeCloseTo(1000, 5);
  });
});
