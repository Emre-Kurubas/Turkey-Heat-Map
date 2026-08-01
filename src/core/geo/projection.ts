import { type GeoPath, type GeoProjection, geoConicEqualArea, geoPath } from 'd3-geo';
import type { Viewport } from '@/core/types/index.js';

export interface ProjectionOptions {
  viewport: Viewport;
  fitTo: GeoJSON.FeatureCollection;
  /** Inset in pixels on every side. Default 8. */
  padding?: number;
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
  const { viewport, fitTo, padding = DEFAULT_PADDING } = options;

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

  return projection.fitExtent(
    [[padding, padding], [viewport.width - padding, viewport.height - padding]],
    fitTo,
  );
}

/** Path generator bound to a projection. Reuse one per render, not one per feature. */
export function createPathGenerator(projection: GeoProjection): GeoPath {
  return geoPath(projection);
}
