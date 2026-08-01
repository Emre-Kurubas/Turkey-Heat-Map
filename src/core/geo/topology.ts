import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { RegionMeta } from '@/core/types/index.js';
import { ilCodeFromIlceCode } from './regions.js';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Decoded collections, keyed by topology then object name.
 *
 * A WeakMap keyed on the topology object means cached results are released as
 * soon as the topology is, without any explicit invalidation.
 */
const CACHE = new WeakMap<Topology, Map<string, GeoJSON.FeatureCollection>>();

/**
 * Converts a TopoJSON object into a GeoJSON FeatureCollection, memoized.
 *
 * Referential stability is the point: decoding is the most expensive geo
 * operation in the library, and returning the identical object across calls lets
 * downstream `useMemo` hooks skip it entirely on re-render.
 *
 * An unknown object name yields an empty collection rather than throwing — a
 * mismatched name is a configuration problem that should degrade to an empty
 * map, not take down the host page.
 */
export function decodeTopology(
  topology: Topology,
  objectName: string,
): GeoJSON.FeatureCollection {
  let perTopology = CACHE.get(topology);
  if (perTopology === undefined) {
    perTopology = new Map();
    CACHE.set(topology, perTopology);
  }

  const cached = perTopology.get(objectName);
  if (cached !== undefined) return cached;

  const object = topology.objects[objectName];
  const decoded: GeoJSON.FeatureCollection = object === undefined
    ? EMPTY
    : (feature(topology, object) as GeoJSON.FeatureCollection);

  perTopology.set(objectName, decoded);
  return decoded;
}

/**
 * Derives region metadata from boundary features.
 *
 * Deliberately derived rather than hand-written: 973 hand-typed ilçe entries
 * would drift from the geometry the moment either changed. Deriving them makes
 * the two impossible to disagree.
 *
 * Features with no id are skipped — a region that cannot be keyed cannot be
 * joined to crime data, and inventing an id would silently mis-attribute it.
 */
export function deriveRegionMeta(collection: GeoJSON.FeatureCollection): RegionMeta[] {
  const metas: RegionMeta[] = [];

  for (const item of collection.features) {
    if (item.id === undefined || item.id === null) continue;

    const code = String(item.id);
    // GeoJSON properties carry an `any` index signature; narrow it deliberately.
    const rawName: unknown = item.properties?.['name'];
    const name = typeof rawName === 'string' && rawName !== '' ? rawName : code;

    metas.push({ code, name, parentCode: ilCodeFromIlceCode(code) });
  }

  return metas;
}

/** Code → display name, for the sidebar, tooltip, and search index. */
export function regionNameMap(metas: readonly RegionMeta[]): Map<string, string> {
  return new Map(metas.map((meta) => [meta.code, meta.name]));
}
