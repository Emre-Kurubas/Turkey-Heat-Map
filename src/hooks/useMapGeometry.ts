import { useMemo } from 'react';
import {
  collectBounds, createPathGenerator, createTurkeyProjection, cullFeatures,
} from '@/core/geo/index.js';
import type { MapFit } from '@/core/geo/index.js';
import type { BBox, GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { getLevelFeatures, getLevelRegionMeta } from '@/data/geo/index.js';

export interface RenderFeature {
  code: string;
  name: string;
  /** SVG path data in projected pixel space, before the group transform. */
  d: string;
}

export interface MapGeometry {
  /**
   * The layer the heat is painted on. Always the finest level the data
   * supports, so colour resolution does not change with zoom.
   */
  heat: readonly RenderFeature[];
  /** Codes from `heat` currently in view. */
  visibleHeat: ReadonlySet<string>;
  /**
   * The layer that is outlined and interacted with. Follows the zoom level:
   * provinces at country zoom, districts once zoomed in.
   */
  outline: readonly RenderFeature[];
  /** Codes from `outline` currently in view. */
  visibleOutline: ReadonlySet<string>;
  /** Bounds of the outline level, for fly-to. */
  bounds: ReadonlyMap<string, BBox>;
  /** False until the container has a real size. */
  ready: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY: MapGeometry = {
  heat: [],
  visibleHeat: EMPTY_SET,
  outline: [],
  visibleOutline: EMPTY_SET,
  bounds: new Map(),
  ready: false,
};

interface ProjectedLevel {
  features: RenderFeature[];
  bounds: ReadonlyMap<string, BBox>;
}

/**
 * Projects a level once per size change and culls per transform.
 *
 * The split matters. Paths are projected in *untransformed* pixel space and the
 * group's `transform` moves them, so panning and zooming never re-project and
 * never re-run the blur filter (§6.3). Only the cull sets depend on the
 * transform, and they are cheap rectangle tests over cached bounds.
 *
 * Both levels share one projection. Fitting each independently would let any
 * difference in their extents offset the district heat from the province
 * borders drawn over it — a misalignment of a pixel or two reads as a rendering
 * bug and there is no reason to risk it, since the two levels cover the same
 * country.
 */
export function useMapGeometry(
  viewport: Viewport,
  outlineLevel: GeoLevel,
  heatLevel: GeoLevel,
  transform: Transform,
  fit: MapFit = 'contain',
): MapGeometry {
  const projected = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    // Fit to provinces: 81 features rather than 973 to scan, and the two levels
    // share a bounding box, so the resulting projection is the same either way.
    const projection = createTurkeyProjection({
      viewport,
      fitTo: getLevelFeatures('il'),
      fit,
    });
    const path = createPathGenerator(projection);

    const project = (level: GeoLevel): ProjectedLevel => {
      const collection = getLevelFeatures(level);
      const meta = getLevelRegionMeta(level);
      const features: RenderFeature[] = [];

      for (const feature of collection.features) {
        if (feature.id === undefined || feature.id === null) continue;

        const d = path(feature);
        // A polygon simplified below one pixel yields null path data. Skipping
        // it is correct — it has no visible area to paint or to hit-test.
        if (d === null || d === '') continue;

        const code = String(feature.id);
        features.push({ code, name: meta.get(code)?.name ?? code, d });
      }

      return { features, bounds: collectBounds(path, collection) };
    };

    const heat = project(heatLevel);
    // Identical levels are projected once, not twice.
    const outline = outlineLevel === heatLevel ? heat : project(outlineLevel);
    return { heat, outline };
  }, [viewport, outlineLevel, heatLevel, fit]);

  const visibleHeat = useMemo(() => (
    projected === null ? EMPTY_SET : cullFeatures(projected.heat.bounds, transform, viewport)
  ), [projected, transform, viewport]);

  const visibleOutline = useMemo(() => (
    projected === null
      ? EMPTY_SET
      : (projected.outline === projected.heat
        ? visibleHeat
        : cullFeatures(projected.outline.bounds, transform, viewport))
  ), [projected, transform, viewport, visibleHeat]);

  return useMemo(() => (
    projected === null ? EMPTY : {
      heat: projected.heat.features,
      visibleHeat,
      outline: projected.outline.features,
      visibleOutline,
      bounds: projected.outline.bounds,
      ready: true,
    }
  ), [projected, visibleHeat, visibleOutline]);
}
