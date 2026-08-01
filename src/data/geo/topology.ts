import type { Topology } from 'topojson-specification';
import { decodeTopology, deriveRegionMeta } from '@/core/geo/index.js';
import type { GeoLevel, RegionMeta } from '@/core/types/index.js';
import ilTopology from './turkiye-il.topo.json';
import ilceTopology from './turkiye-ilce.topo.json';

export const LEVELS = ['il', 'ilce'] as const satisfies readonly GeoLevel[];

/**
 * Zoom at which the map switches from provinces to districts, with a band
 * around it so a scroll that lands near the threshold does not flicker between
 * levels (§7.1).
 */
export const LEVEL_THRESHOLD = 2.5;
export const LEVEL_HYSTERESIS = 0.15;

/** The boundary data is ODbL/CC-BY-SA. Attribution is not optional (§5.4). */
export const ATTRIBUTION_REQUIRED = true;

const TOPOLOGIES: Record<GeoLevel, unknown> = {
  il: ilTopology,
  ilce: ilceTopology,
};

/**
 * Decoded features for a level.
 *
 * `decodeTopology` memoizes on the topology object, and the imported JSON
 * modules are singletons, so this is referentially stable for the process
 * lifetime — which is what lets `useMemo` downstream skip re-decoding and
 * re-projecting on every render.
 */
export function getLevelFeatures(level: GeoLevel): GeoJSON.FeatureCollection {
  return decodeTopology(TOPOLOGIES[level] as Topology, level);
}

const META_CACHE = new Map<GeoLevel, ReadonlyMap<string, RegionMeta>>();

/**
 * Region metadata derived from the geometry, keyed by code.
 *
 * `deriveRegionMeta` returns a flat `RegionMeta[]`; the map is built here and
 * cached, because every lookup downstream is by code.
 */
export function getLevelRegionMeta(level: GeoLevel): ReadonlyMap<string, RegionMeta> {
  let cached = META_CACHE.get(level);
  if (cached === undefined) {
    const metas: RegionMeta[] = deriveRegionMeta(getLevelFeatures(level));
    cached = new Map(metas.map((meta) => [meta.code, meta]));
    META_CACHE.set(level, cached);
  }
  return cached;
}
