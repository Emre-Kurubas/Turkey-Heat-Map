import type { Topology } from 'topojson-specification';
import { IL_BY_CODE, decodeTopology, ilCodeFromIlceCode } from '@/core/geo/index.js';
import type { GeoLevel, RegionMeta } from '@/core/types/index.js';
import ilTopology from './turkiye-il.topo.json';
import ilceNames from './turkiye-ilce.names.json';

export const LEVELS = ['il', 'ilce'] as const satisfies readonly GeoLevel[];

/**
 * Zoom at which the map switches from provinces to districts, with a band
 * around it so a scroll that lands near the threshold does not flicker between
 * levels.
 */
export const LEVEL_THRESHOLD = 2.5;
export const LEVEL_HYSTERESIS = 0.15;

/** The boundary data is ODbL/CC-BY-SA. Attribution is not optional. */
export const ATTRIBUTION_REQUIRED = true;

/*
 * District geometry is loaded on demand; everything else is here from the start.
 *
 * The two are wanted at different moments. Every district's code and name is
 * needed the instant the component mounts — to validate incoming records, to
 * build the search index, to label a tooltip — but the 262 KB of arcs behind
 * them are only needed once the map actually draws district boundaries.
 * Bundling them together meant parsing all of it before the first province
 * could be painted.
 *
 * So the names ship statically (17 KB) and the geometry is a dynamic import,
 * which the bundler splits into its own chunk. The map paints provinces
 * immediately and sharpens to district resolution when the chunk lands.
 */
let ilceTopology: Topology | null = null;
let ilcePending: Promise<Topology> | null = null;

/*
 * Who to tell when a level arrives.
 *
 * Module state, not React state, because three hooks need the same answer and
 * they are not in a parent/child relationship: the aggregation level, the zoom
 * level and the projected geometry all have to agree about whether districts
 * can be drawn, and any disagreement paints district totals onto province
 * shapes.
 */
const listeners = new Set<() => void>();

export function subscribeLevels(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Whether a level can be drawn right now. */
export function isLevelLoaded(level: GeoLevel): boolean {
  return level === 'il' || ilceTopology !== null;
}

/** Province geometry. Always present: it is what the projection is fitted to. */
function ilFeatures(): GeoJSON.FeatureCollection {
  return decodeTopology(ilTopology as unknown as Topology, 'il');
}

/**
 * The geometry that is available *right now*, or null if it has yet to arrive.
 *
 * Synchronous by design. Every caller is a render path, and a render cannot
 * wait — it draws what it has and runs again when `loadLevelFeatures` resolves.
 */
export function peekLevelFeatures(level: GeoLevel): GeoJSON.FeatureCollection | null {
  if (level === 'il') return ilFeatures();
  return ilceTopology === null ? null : decodeTopology(ilceTopology, 'ilce');
}

/**
 * Loads a level's geometry, caching both the module and the request in flight.
 *
 * Caching the promise as well as the result is what stops several components
 * asking at once from racing to start their own fetch.
 */
export async function loadLevelFeatures(
  level: GeoLevel,
): Promise<GeoJSON.FeatureCollection> {
  if (level === 'il') return ilFeatures();
  if (ilceTopology !== null) return decodeTopology(ilceTopology, 'ilce');

  ilcePending ??= import('./turkiye-ilce.topo.json')
    .then((module) => (module.default ?? module) as unknown as Topology);

  ilceTopology = await ilcePending;
  for (const listener of listeners) listener();
  return decodeTopology(ilceTopology, 'ilce');
}

const META_CACHE = new Map<GeoLevel, ReadonlyMap<string, RegionMeta>>();

/**
 * Region metadata, keyed by code. Synchronous at either level.
 *
 * Read from the shipped name tables rather than derived from the geometry,
 * which is the whole point of separating the two: the record validator and the
 * search index both want this at mount, so deriving it would drag the district
 * arcs back into the initial bundle through the side door.
 */
export function getLevelRegionMeta(level: GeoLevel): ReadonlyMap<string, RegionMeta> {
  let cached = META_CACHE.get(level);
  if (cached === undefined) {
    cached = level === 'il'
      ? IL_BY_CODE
      : new Map(Object.entries(ilceNames as Record<string, string>).map(
        ([code, name]): [string, RegionMeta] => (
          [code, { code, name, parentCode: ilCodeFromIlceCode(code) }]
        ),
      ));
    META_CACHE.set(level, cached);
  }
  return cached;
}
