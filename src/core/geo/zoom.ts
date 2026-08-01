import type { GeoLevel, Transform, Viewport } from '@/core/types/index.js';

/** Zoom range from §7.1. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  return value > max ? max : value;
}

/**
 * Constrains scale to [MIN_ZOOM, MAX_ZOOM] and translation so the content
 * always covers the viewport.
 *
 * At scale k the content is k times the viewport, leaving (k-1) viewports of
 * travel in each axis. At k=1 there is none, so the only legal transform is
 * identity — which is why the map cannot be dragged away from its frame.
 */
export function clampTransform(transform: Transform, viewport: Viewport): Transform {
  if (viewport.width <= 0 || viewport.height <= 0) return IDENTITY;

  const k = clamp(transform.k, MIN_ZOOM, MAX_ZOOM);
  const maxPanX = viewport.width * (k - 1);
  const maxPanY = viewport.height * (k - 1);

  return {
    k,
    x: clamp(transform.x, -maxPanX, 0),
    y: clamp(transform.y, -maxPanY, 0),
  };
}

/**
 * Scales about a screen point, keeping whatever is under that point fixed.
 *
 * Anchoring on the pointer is what makes wheel-zoom feel direct rather than
 * like the map jumping to centre.
 */
export function zoomAt(
  transform: Transform,
  factor: number,
  point: readonly [number, number],
  viewport: Viewport,
): Transform {
  if (viewport.width <= 0 || viewport.height <= 0) return IDENTITY;

  const k = clamp(transform.k * factor, MIN_ZOOM, MAX_ZOOM);
  // Solve for the translation that leaves `point` over the same world position.
  const worldX = (point[0] - transform.x) / transform.k;
  const worldY = (point[1] - transform.y) / transform.k;

  return clampTransform(
    { k, x: point[0] - worldX * k, y: point[1] - worldY * k },
    viewport,
  );
}

export function panBy(
  transform: Transform,
  dx: number,
  dy: number,
  viewport: Viewport,
): Transform {
  return clampTransform(
    { k: transform.k, x: transform.x + dx, y: transform.y + dy },
    viewport,
  );
}

/**
 * Chooses the geography level for a zoom scale, with a dead band around the
 * threshold.
 *
 * Without hysteresis, a scale resting near the threshold flips level on every
 * pixel of scroll, re-decoding 973 polygons each time. The band means a switch
 * requires committing past it, and the level then sticks until the scale
 * crosses back past the far edge.
 */
export function deriveLevel(
  k: number,
  current: GeoLevel,
  threshold: number,
  hysteresis: number,
): GeoLevel {
  if (k > threshold + hysteresis) return 'ilce';
  if (k < threshold - hysteresis) return 'il';
  return current;
}
