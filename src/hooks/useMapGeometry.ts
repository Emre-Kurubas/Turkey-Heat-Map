import { useMemo } from 'react';
import {
  collectBounds, createPathGenerator, createTurkeyProjection, cullFeatures,
} from '@/core/geo/index.js';
import type { BBox, GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { getLevelFeatures, getLevelRegionMeta } from '@/data/geo/index.js';

export interface RenderFeature {
  code: string;
  name: string;
  /** SVG path data in projected pixel space, before the group transform. */
  d: string;
}

export interface MapGeometry {
  features: readonly RenderFeature[];
  /** Codes currently inside the viewport. */
  visible: ReadonlySet<string>;
  bounds: ReadonlyMap<string, BBox>;
  /** False until the container has a real size. */
  ready: boolean;
}

const EMPTY_VISIBLE: ReadonlySet<string> = new Set();
const EMPTY: MapGeometry = {
  features: [],
  visible: EMPTY_VISIBLE,
  bounds: new Map(),
  ready: false,
};

/**
 * Projects a level once per size change and culls per transform.
 *
 * The split matters. Paths are projected in *untransformed* pixel space and the
 * group's `transform` moves them, so panning and zooming never re-project and
 * never re-run the blur filter (§6.3). Only the cull set depends on the
 * transform, and it is a cheap rectangle test over cached bounds.
 */
export function useMapGeometry(
  viewport: Viewport,
  level: GeoLevel,
  transform: Transform,
): MapGeometry {
  const projected = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    const collection = getLevelFeatures(level);
    const projection = createTurkeyProjection({ viewport, fitTo: collection });
    const path = createPathGenerator(projection);
    const meta = getLevelRegionMeta(level);

    const features: RenderFeature[] = [];
    for (const feature of collection.features) {
      if (feature.id === undefined || feature.id === null) continue;

      const d = path(feature);
      // A polygon simplified below one pixel yields null path data. Skipping it
      // is correct — it has no visible area to paint or to hit-test.
      if (d === null || d === '') continue;

      const code = String(feature.id);
      features.push({ code, name: meta.get(code)?.name ?? code, d });
    }

    return { features, bounds: collectBounds(path, collection) };
  }, [viewport, level]);

  const visible = useMemo(() => {
    if (projected === null) return EMPTY_VISIBLE;
    return cullFeatures(projected.bounds, transform, viewport);
  }, [projected, transform, viewport]);

  return useMemo(() => (
    projected === null
      ? EMPTY
      : { features: projected.features, bounds: projected.bounds, visible, ready: true }
  ), [projected, visible]);
}
