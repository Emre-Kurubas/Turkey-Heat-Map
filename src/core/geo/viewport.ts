import type { BBox, Transform, Viewport } from '@/core/types/index.js';

/**
 * Extra pixels beyond each viewport edge to keep rendered.
 *
 * Without a margin, geometry would pop into existence exactly at the edge during
 * a pan. A margin means the next frame's newly-visible regions are already drawn.
 */
const DEFAULT_MARGIN = 100;

/**
 * Whether a projected bounding box intersects the visible area under `transform`.
 * Uses the convention fixed in bounds.ts: `screen = point * k + [x, y]`.
 */
export function isVisible(
  bbox: BBox,
  transform: Transform,
  viewport: Viewport,
  margin: number = DEFAULT_MARGIN,
): boolean {
  if (viewport.width <= 0 || viewport.height <= 0) return false;

  const [[minX, minY], [maxX, maxY]] = bbox;
  const { k, x, y } = transform;

  const left = minX * k + x;
  const right = maxX * k + x;
  const top = minY * k + y;
  const bottom = maxY * k + y;

  // Separating-axis test: not visible only if fully beyond one edge.
  return !(
    right < -margin
    || left > viewport.width + margin
    || bottom < -margin
    || top > viewport.height + margin
  );
}

/**
 * Ids of features intersecting the visible area.
 *
 * At ilçe level the map holds 973 polygons; at high zoom perhaps thirty are on
 * screen. Rendering only those is what keeps a pan at 60 fps.
 */
export function cullFeatures(
  bounds: ReadonlyMap<string, BBox>,
  transform: Transform,
  viewport: Viewport,
  margin: number = DEFAULT_MARGIN,
): Set<string> {
  const visible = new Set<string>();

  for (const [id, bbox] of bounds) {
    if (isVisible(bbox, transform, viewport, margin)) visible.add(id);
  }

  return visible;
}
