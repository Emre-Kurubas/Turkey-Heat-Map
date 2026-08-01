import type { GeoPath } from 'd3-geo';
import type { BBox, Transform, Viewport } from '@/core/types/index.js';

export interface FitOptions {
  padding?: number;
  maxScale?: number;
  minScale?: number;
}

const DEFAULT_PADDING = 40;
const DEFAULT_MAX_SCALE = 12;
const DEFAULT_MIN_SCALE = 1;

const ORIGIN_BBOX: BBox = [[0, 0], [0, 0]];

function isFiniteBounds(bounds: [[number, number], [number, number]]): boolean {
  return bounds.every((pair) => pair.every((value) => Number.isFinite(value)));
}

/**
 * Projected bounding box of a feature.
 *
 * d3 returns ±Infinity for empty geometry; that is collapsed to a zero-size box
 * at the origin so downstream arithmetic never produces NaN.
 */
export function featureBounds(path: GeoPath, feature: GeoJSON.Feature): BBox {
  const bounds = path.bounds(feature);
  return isFiniteBounds(bounds) ? bounds : ORIGIN_BBOX;
}

/**
 * Bounding boxes for every identifiable feature, keyed by id.
 * Computed once per projection and reused by viewport culling on every pan.
 */
export function collectBounds(
  path: GeoPath,
  collection: GeoJSON.FeatureCollection,
): Map<string, BBox> {
  const bounds = new Map<string, BBox>();

  for (const feature of collection.features) {
    if (feature.id === undefined || feature.id === null) continue;
    bounds.set(String(feature.id), featureBounds(path, feature));
  }

  return bounds;
}

/** Projected centroid, used to anchor labels and fly-to targets. */
export function featureCentroid(path: GeoPath, feature: GeoJSON.Feature): [number, number] {
  const [x, y] = path.centroid(feature);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : [0, 0];
}

/**
 * Computes the transform that centers and fits a bounding box in the viewport.
 *
 * Convention: `screen = point * k + [x, y]`, which maps directly onto the SVG
 * attribute `transform="translate(x, y) scale(k)"`. Keeping the math in the same
 * convention as the DOM means Phase 2 hands this straight to the element with no
 * conversion step to get wrong.
 */
export function computeFitTransform(
  bbox: BBox,
  viewport: Viewport,
  options: FitOptions = {},
): Transform {
  const {
    padding = DEFAULT_PADDING,
    maxScale = DEFAULT_MAX_SCALE,
    minScale = DEFAULT_MIN_SCALE,
  } = options;

  const [[minX, minY], [maxX, maxY]] = bbox;
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);

  // Fit the more constrained axis so the region is never cropped. A zero-size
  // box carries no scale information, so it falls back to maxScale.
  const scaleX = boxWidth > 0 ? usableWidth / boxWidth : Number.POSITIVE_INFINITY;
  const scaleY = boxHeight > 0 ? usableHeight / boxHeight : Number.POSITIVE_INFINITY;
  const fitted = Math.min(scaleX, scaleY);

  const k = Math.min(maxScale, Math.max(minScale, Number.isFinite(fitted) ? fitted : maxScale));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    k,
    x: viewport.width / 2 - centerX * k,
    y: viewport.height / 2 - centerY * k,
  };
}
