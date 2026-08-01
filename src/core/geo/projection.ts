import { type GeoPath, type GeoProjection, geoConicEqualArea, geoPath } from 'd3-geo';
import type { Viewport } from '@/core/types/index.js';

/**
 * How the default view relates the country to the viewport.
 *
 * `contain` shows the whole country and letterboxes whichever axis is left
 * over. `fill` covers the viewport and crops the overflow instead.
 *
 * There is no third option: Türkiye's bounding box is roughly 2.3:1 and a
 * browser window is rarely wider than 1.8:1, so vertical space can only be
 * bought with horizontal cropping, one pixel for one pixel.
 */
export type MapFit = 'contain' | 'fill';

export interface ProjectionOptions {
  viewport: Viewport;
  fitTo: GeoJSON.FeatureCollection;
  /** Inset in pixels on every side. Default 8. */
  padding?: number;
  /** Default `contain` — the whole country visible on first paint. */
  fit?: MapFit;
}

const DEFAULT_PADDING = 8;

/**
 * Turkey's latitude span is roughly 36°N to 42°N; standard parallels at 37 and
 * 41 keep distortion minimal across the whole country. The rotation centers the
 * projection on ~35°E so the country sits square in the frame.
 */
const STANDARD_PARALLELS: [number, number] = [37, 41];
const CENTRAL_MERIDIAN = 35;

/**
 * Builds the map projection.
 *
 * Equal-area, not Mercator. A choropleth encodes magnitude by color across area,
 * so a projection that inflates northern regions would systematically overstate
 * how much of the country a given color covers. That is a correctness problem,
 * not a styling preference.
 */
export function createTurkeyProjection(options: ProjectionOptions): GeoProjection {
  const { viewport, fitTo, padding = DEFAULT_PADDING, fit = 'contain' } = options;

  const projection = geoConicEqualArea()
    .parallels(STANDARD_PARALLELS)
    .rotate([-CENTRAL_MERIDIAN, 0]);

  // A container measured before layout reports 0x0, and an empty collection has
  // no extent to fit. Both are transient states, not errors — return the
  // unfitted projection and let the caller re-create it once a real size and
  // real features arrive.
  const usableWidth = viewport.width - padding * 2;
  const usableHeight = viewport.height - padding * 2;
  if (usableWidth <= 0 || usableHeight <= 0 || fitTo.features.length === 0) {
    return projection;
  }

  projection.fitExtent(
    [[padding, padding], [viewport.width - padding, viewport.height - padding]],
    fitTo,
  );

  if (fit === 'contain') return projection;

  /*
   * `fitExtent` is a contain fit: it takes the *smaller* of the two axis ratios
   * so nothing spills out. Covering means taking the larger one instead, which
   * d3-geo has no built-in for, so rescale about the country's centre.
   *
   * Scaling by k about the current translate maps a screen point p to
   * `T' + k·(p − T)`. Solving that for "the country's centre lands on the
   * viewport's centre" gives the translate below. Doing it this way rather
   * than by a second fitExtent keeps the standard parallels untouched — the
   * projection stays equal-area, which the choropleth depends on.
   */
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(fitTo);
  const width = x1 - x0;
  const height = y1 - y0;
  // Degenerate bounds would divide by zero. Nothing sensible to cover, so the
  // contain fit stands.
  if (width <= 0 || height <= 0) return projection;

  const k = Math.max(usableWidth / width, usableHeight / height);
  const [tx, ty] = projection.translate();

  return projection
    .scale(projection.scale() * k)
    .translate([
      viewport.width / 2 + k * (tx - (x0 + x1) / 2),
      viewport.height / 2 + k * (ty - (y0 + y1) / 2),
    ]);
}

/** Path generator bound to a projection. Reuse one per render, not one per feature. */
export function createPathGenerator(projection: GeoProjection): GeoPath {
  return geoPath(projection);
}
