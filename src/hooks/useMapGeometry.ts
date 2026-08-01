import { useMemo } from 'react';
import {
  collectBounds, createPathGenerator, createTurkeyProjection, cullFeatures,
} from '@/core/geo/index.js';
import type { MapFit } from '@/core/geo/index.js';
import type { BBox, GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { getLevelRegionMeta, peekLevelFeatures } from '@/data/geo/index.js';
import { useLoadedLevel } from './useLoadedLevel.js';

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
  /**
   * Provinces, always, whatever the outlined level.
   *
   * Two callers need them at district zoom, when they are not the outline: the
   * heat's clip path, which is the union of the country, and the boundary of
   * the province the reader has drilled into — the one line that says where
   * they are once the province borders are gone.
   */
  provinces: readonly RenderFeature[];
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
  provinces: [],
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
 * never re-run the blur filter. Only the cull sets depend on the
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
  /*
   * District geometry is a separate chunk, so what this hook can draw changes
   * after mount. `peekLevelFeatures` starts returning districts the moment the
   * import resolves, but nothing about that is observable to React on its own —
   * this is the subscription that makes it so, and the same one the aggregation
   * and zoom levels read, so all three agree about what can be drawn.
   */
  const districtsDrawable = useLoadedLevel('ilce');

  const projected = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;
    /*
     * Read, not ignored. `peekLevelFeatures` below reads module state that the
     * dependency array cannot see, and this is the value that says it changed —
     * naming it here is what makes the memo correct and what stops the
     * exhaustive-deps rule reporting it as surplus.
     */
    void districtsDrawable;

    // Fit to provinces: 81 features rather than 973 to scan, and the two levels
    // share a bounding box, so the resulting projection is the same either way.
    // Provinces are also the one level guaranteed to be loaded.
    const projection = createTurkeyProjection({
      viewport,
      fitTo: peekLevelFeatures('il') ?? { type: 'FeatureCollection', features: [] },
      fit,
    });
    const path = createPathGenerator(projection);

    const project = (level: GeoLevel): ProjectedLevel | null => {
      const collection = peekLevelFeatures(level);
      // Not here yet. The caller falls back to a level that is.
      if (collection === null) return null;
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

    /*
     * Provinces are the floor. A level whose chunk has not landed falls back to
     * them rather than rendering nothing: the map paints a province-resolution
     * map immediately and sharpens when the districts arrive, which is a better
     * first frame than a spinner over an empty country.
     */
    const provinces = project('il')!;
    const heat = project(heatLevel) ?? provinces;
    // Identical levels are projected once, not twice.
    const outline = outlineLevel === heatLevel ? heat : (project(outlineLevel) ?? provinces);
    return { heat, outline, provinces };
  }, [viewport, outlineLevel, heatLevel, fit, districtsDrawable]);

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
      provinces: projected.provinces.features,
      bounds: projected.outline.bounds,
      ready: true,
    }
  ), [projected, visibleHeat, visibleOutline]);
}
