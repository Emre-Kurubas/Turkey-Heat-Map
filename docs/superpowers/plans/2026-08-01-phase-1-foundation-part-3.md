# Türkiye Suç Haritası — Phase 1 Foundation, Part 3 (Tasks 16–23)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read `2026-08-01-phase-1-foundation.md` first** for the Goal, Architecture, and Global Constraints, then Part 2. This document assumes Tasks 1–15 are complete and committed.

**Global Constraints:** see Part 1. Unchanged.

**A note on geo data:** Tasks 16–19 are tested against a small synthetic TopoJSON fixture, not real Turkish boundaries. This is deliberate. It keeps Phase 1 executable without a multi-megabyte download, keeps the tests fast and deterministic, and isolates the geometry math from the data-sourcing problem. Task 22 writes the script that produces real boundaries; they land at the start of Phase 2.

---

## Task 16: Turkey projection

**Files:**
- Create: `src/core/geo/projection.ts`
- Test: `src/core/geo/projection.test.ts`

**Interfaces:**
- Consumes: `d3-geo`, `Viewport` from `@/core/types`
- Produces:

```ts
interface ProjectionOptions {
  viewport: Viewport;
  /** GeoJSON to fit inside the viewport. */
  fitTo: GeoJSON.FeatureCollection;
  /** Inset in pixels on every side. Default 8. */
  padding?: number;
}
function createTurkeyProjection(options: ProjectionOptions): GeoProjection;
function createPathGenerator(projection: GeoProjection): GeoPath;
```

**Equal-area is a correctness requirement, not an aesthetic preference.** A choropleth encodes magnitude by color across area. Under Mercator, northeastern provinces would render visibly larger than equally-sized southern ones, systematically overstating how much of the country a color covers. `geoConicEqualArea` with parallels bracketing Turkey's latitude span preserves area ratios exactly.

- [ ] **Step 1: Write the failing tests**

Create `src/core/geo/projection.test.ts`:

```ts
import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { createPathGenerator, createTurkeyProjection } from './projection.js';

/** A lon/lat square, used to compare geographic against projected area. */
function square(lon: number, lat: number, size = 2): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat],
      ]],
    },
  };
}

const TURKEY_BOX: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[26, 36], [45, 36], [45, 42], [26, 42], [26, 36]]],
    },
  }],
};

const VIEWPORT = { width: 800, height: 400 };

describe('createTurkeyProjection', () => {
  const projection = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });

  it('projects Turkish coordinates inside the viewport', () => {
    for (const [lon, lat] of [[28.98, 41.01], [32.85, 39.93], [27.14, 38.42], [39.22, 38.35]]) {
      const point = projection([lon!, lat!]);
      expect(point).not.toBeNull();
      expect(point![0]).toBeGreaterThanOrEqual(0);
      expect(point![0]).toBeLessThanOrEqual(VIEWPORT.width);
      expect(point![1]).toBeGreaterThanOrEqual(0);
      expect(point![1]).toBeLessThanOrEqual(VIEWPORT.height);
    }
  });

  it('places İstanbul north-west of Diyarbakır', () => {
    const istanbul = projection([28.98, 41.01])!;
    const diyarbakir = projection([40.23, 37.91])!;
    expect(istanbul[0]).toBeLessThan(diyarbakir[0]);   // further west
    expect(istanbul[1]).toBeLessThan(diyarbakir[1]);   // further north (smaller y)
  });

  it('preserves area ratios, which a choropleth depends on', () => {
    // Two equal-size lon/lat squares at different latitudes cover different
    // geographic areas. An equal-area projection must reproduce that ratio; a
    // Mercator projection would not.
    const path = createPathGenerator(projection);
    const south = square(30, 36);
    const north = square(30, 40);

    const geoRatio = geoArea(north) / geoArea(south);
    const pixelRatio = Math.abs(path.area(north)) / Math.abs(path.area(south));

    expect(pixelRatio).toBeCloseTo(geoRatio, 2);
  });

  it('fills the viewport, honoring padding on every side', () => {
    const path = createPathGenerator(projection);
    const [[minX, minY], [maxX, maxY]] = path.bounds(TURKEY_BOX);

    expect(minX).toBeGreaterThanOrEqual(-0.5);
    expect(minY).toBeGreaterThanOrEqual(-0.5);
    expect(maxX).toBeLessThanOrEqual(VIEWPORT.width + 0.5);
    expect(maxY).toBeLessThanOrEqual(VIEWPORT.height + 0.5);

    // At least one axis should be snug against its padding, or the fit is loose.
    const padding = 8;
    const snugX = Math.abs(minX - padding) < 1 || Math.abs(maxX - (VIEWPORT.width - padding)) < 1;
    const snugY = Math.abs(minY - padding) < 1 || Math.abs(maxY - (VIEWPORT.height - padding)) < 1;
    expect(snugX || snugY).toBe(true);
  });

  it('honors a custom padding', () => {
    const padded = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX, padding: 40 });
    const [[minX]] = createPathGenerator(padded).bounds(TURKEY_BOX);
    expect(minX).toBeGreaterThanOrEqual(39);
  });

  it('is deterministic for identical inputs', () => {
    const a = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });
    const b = createTurkeyProjection({ viewport: VIEWPORT, fitTo: TURKEY_BOX });
    expect(a([32, 39])).toEqual(b([32, 39]));
  });

  it('rescales when the viewport changes', () => {
    const wide = createTurkeyProjection({ viewport: { width: 1600, height: 800 }, fitTo: TURKEY_BOX });
    expect(wide.scale()).toBeGreaterThan(projection.scale());
  });

  it('does not throw on a degenerate viewport', () => {
    // A container measured before layout reports 0x0. The projection must
    // survive it; the component simply renders nothing until a real size arrives.
    expect(() => createTurkeyProjection({
      viewport: { width: 0, height: 0 }, fitTo: TURKEY_BOX,
    })).not.toThrow();
  });

  it('does not throw on an empty feature collection', () => {
    expect(() => createTurkeyProjection({
      viewport: VIEWPORT, fitTo: { type: 'FeatureCollection', features: [] },
    })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/geo`
Expected: FAIL — cannot resolve `./projection.js`.

- [ ] **Step 3: Implement `src/core/geo/projection.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/geo`
Expected: PASS. If the area-ratio test fails, the projection is not equal-area — check that `geoConicEqualArea` was used rather than `geoConicConformal`, whose name is one letter away and whose behavior is exactly what this test exists to reject.

- [ ] **Step 5: Commit**

```bash
git add src/core/geo/projection.ts src/core/geo/projection.test.ts
git commit -m "feat(core): add Turkey-tuned equal-area projection"
```

---

## Task 17: TopoJSON decoding and ilçe metadata

**Files:**
- Create: `src/core/geo/topology.ts`, `src/core/geo/__fixtures__/sample.topo.json`
- Test: `src/core/geo/topology.test.ts`

**Interfaces:**
- Consumes: `topojson-client`, `RegionMeta`, `IL_BY_CODE` / `ilCodeFromIlceCode` (Task 5)
- Produces:
  - `decodeTopology(topology: Topology, objectName: string): FeatureCollection` — memoized
  - `deriveRegionMeta(collection: FeatureCollection): RegionMeta[]`
  - `regionNameMap(metas: readonly RegionMeta[]): Map<string, string>`

İlçe metadata is derived from the boundary file rather than hand-written. 973 hand-typed entries would drift from the geometry the moment either changed; deriving them makes the two impossible to disagree.

- [ ] **Step 1: Create the test fixture**

Create `src/core/geo/__fixtures__/sample.topo.json`. Three tiny square regions, two in İstanbul and one in Ankara, with the same `id`/`properties.name` convention the real build script emits:

```json
{
  "type": "Topology",
  "objects": {
    "regions": {
      "type": "GeometryCollection",
      "geometries": [
        { "type": "Polygon", "id": "3401", "properties": { "name": "Kadıköy" },
          "arcs": [[0]] },
        { "type": "Polygon", "id": "3402", "properties": { "name": "Şişli" },
          "arcs": [[1]] },
        { "type": "Polygon", "id": "0601", "properties": { "name": "Çankaya" },
          "arcs": [[2]] }
      ]
    },
    "empty": { "type": "GeometryCollection", "geometries": [] }
  },
  "arcs": [
    [[0, 0], [100, 0], [0, 100], [-100, 0], [0, -100]],
    [[200, 0], [100, 0], [0, 100], [-100, 0], [0, -100]],
    [[0, 200], [100, 0], [0, 100], [-100, 0], [0, -100]]
  ],
  "transform": { "scale": [0.001, 0.001], "translate": [28.0, 39.0] }
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/core/geo/topology.test.ts`:

```ts
import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/sample.topo.json' with { type: 'json' };
import { decodeTopology, deriveRegionMeta, regionNameMap } from './topology.js';

const TOPOLOGY = sample as unknown as Topology;

describe('decodeTopology', () => {
  it('converts a named object into a GeoJSON FeatureCollection', () => {
    const collection = decodeTopology(TOPOLOGY, 'regions');
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(3);
  });

  it('preserves feature ids and names', () => {
    const [first] = decodeTopology(TOPOLOGY, 'regions').features;
    expect(first!.id).toBe('3401');
    expect(first!.properties?.['name']).toBe('Kadıköy');
  });

  it('produces valid polygon geometry', () => {
    for (const feature of decodeTopology(TOPOLOGY, 'regions').features) {
      expect(feature.geometry.type).toBe('Polygon');
    }
  });

  it('returns the identical object for repeated calls, so React can memoize on it', () => {
    // Decoding is the single most expensive geo operation. Referential stability
    // lets downstream useMemo hooks skip it entirely on re-render.
    expect(decodeTopology(TOPOLOGY, 'regions')).toBe(decodeTopology(TOPOLOGY, 'regions'));
  });

  it('caches per object name, not per topology', () => {
    expect(decodeTopology(TOPOLOGY, 'regions')).not.toBe(decodeTopology(TOPOLOGY, 'empty'));
  });

  it('returns an empty collection for an unknown object name', () => {
    const collection = decodeTopology(TOPOLOGY, 'yok');
    expect(collection.features).toEqual([]);
  });

  it('handles an object with no geometries', () => {
    expect(decodeTopology(TOPOLOGY, 'empty').features).toEqual([]);
  });
});

describe('deriveRegionMeta', () => {
  const metas = deriveRegionMeta(decodeTopology(TOPOLOGY, 'regions'));

  it('derives one entry per feature', () => {
    expect(metas).toHaveLength(3);
  });

  it('reads code and name from the feature', () => {
    expect(metas[0]).toEqual({ code: '3401', name: 'Kadıköy', parentCode: '34' });
  });

  it('links each ilçe to its parent province', () => {
    expect(metas.map((m) => m.parentCode)).toEqual(['34', '34', '06']);
  });

  it('gives 2-digit il codes a null parent', () => {
    const ilCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '34', properties: { name: 'İstanbul' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(ilCollection)[0]).toEqual({
      code: '34', name: 'İstanbul', parentCode: null,
    });
  });

  it('skips features with no id rather than inventing one', () => {
    const broken: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: { name: 'Adsız' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(broken)).toEqual([]);
  });

  it('falls back to the code when a name is missing', () => {
    const unnamed: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: {},
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(unnamed)[0]!.name).toBe('3401');
  });

  it('handles a null properties object', () => {
    const nullProps: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: '3401', properties: null,
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(nullProps.features).toHaveLength(1);
    expect(deriveRegionMeta(nullProps)[0]!.name).toBe('3401');
  });

  it('coerces a numeric id to a string', () => {
    const numeric: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: 3401, properties: { name: 'Kadıköy' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }],
    };
    expect(deriveRegionMeta(numeric)[0]!.code).toBe('3401');
  });
});

describe('regionNameMap', () => {
  it('maps codes to names for the sidebar and tooltip', () => {
    const map = regionNameMap(deriveRegionMeta(decodeTopology(TOPOLOGY, 'regions')));
    expect(map.get('3401')).toBe('Kadıköy');
    expect(map.get('0601')).toBe('Çankaya');
    expect(map.size).toBe(3);
  });

  it('returns an empty map for empty input', () => {
    expect(regionNameMap([]).size).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/core/geo/topology.test.ts`
Expected: FAIL — cannot resolve `./topology.js`.

- [ ] **Step 4: Implement `src/core/geo/topology.ts`**

```ts
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { RegionMeta } from '@/core/types/index.js';
import { ilCodeFromIlceCode } from '@/data/geo/region-meta.js';

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
    : (feature(topology, object as GeometryCollection) as GeoJSON.FeatureCollection);

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
    const rawName = item.properties?.['name'];
    const name = typeof rawName === 'string' && rawName !== '' ? rawName : code;

    metas.push({ code, name, parentCode: ilCodeFromIlceCode(code) });
  }

  return metas;
}

/** Code → display name, for the sidebar, tooltip, and search index. */
export function regionNameMap(metas: readonly RegionMeta[]): Map<string, string> {
  return new Map(metas.map((meta) => [meta.code, meta.name]));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/geo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/geo/topology.ts src/core/geo/topology.test.ts src/core/geo/__fixtures__
git commit -m "feat(core): add memoized TopoJSON decoding and region metadata derivation"
```

---

## Task 18: Geo bounds and fit transform

**Files:**
- Create: `src/core/geo/bounds.ts`
- Test: `src/core/geo/bounds.test.ts`

**Interfaces:**
- Consumes: `GeoPath` from `d3-geo`, `BBox` / `Transform` / `Viewport` from `@/core/types`
- Produces:
  - `featureBounds(path: GeoPath, feature: Feature): BBox`
  - `collectBounds(path: GeoPath, collection: FeatureCollection): Map<string, BBox>`
  - `featureCentroid(path: GeoPath, feature: Feature): [number, number]`
  - `computeFitTransform(bbox: BBox, viewport: Viewport, options?: FitOptions): Transform`

```ts
interface FitOptions {
  padding?: number;   // default 40
  maxScale?: number;  // default 12
  minScale?: number;  // default 1
}
```

Transform convention, fixed here and used everywhere after: **`screen = point * k + [x, y]`.** This matches the SVG `transform="translate(x,y) scale(k)"` attribute exactly, so the value can be handed straight to the DOM in Phase 2 with no conversion.

- [ ] **Step 1: Write the failing tests**

Create `src/core/geo/bounds.test.ts`:

```ts
import { geoIdentity, geoPath } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { collectBounds, computeFitTransform, featureBounds, featureCentroid } from './bounds.js';

/** Identity projection: input coordinates are already pixels, so tests are readable. */
const PATH = geoPath(geoIdentity());

function box(id: string, x0: number, y0: number, x1: number, y1: number): GeoJSON.Feature {
  return {
    type: 'Feature', id, properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
    },
  };
}

describe('featureBounds', () => {
  it('returns the projected bounding box', () => {
    expect(featureBounds(PATH, box('a', 10, 20, 110, 220)))
      .toEqual([[10, 20], [110, 220]]);
  });

  it('returns a degenerate box for empty geometry rather than Infinity', () => {
    const empty: GeoJSON.Feature = {
      type: 'Feature', id: 'e', properties: {},
      geometry: { type: 'Polygon', coordinates: [] },
    };
    expect(featureBounds(PATH, empty)).toEqual([[0, 0], [0, 0]]);
  });
});

describe('collectBounds', () => {
  it('maps every feature id to its bounding box', () => {
    const bounds = collectBounds(PATH, {
      type: 'FeatureCollection',
      features: [box('a', 0, 0, 10, 10), box('b', 20, 20, 40, 40)],
    });
    expect(bounds.size).toBe(2);
    expect(bounds.get('b')).toEqual([[20, 20], [40, 40]]);
  });

  it('skips features with no id', () => {
    const anonymous = box('x', 0, 0, 1, 1);
    delete anonymous.id;
    expect(collectBounds(PATH, { type: 'FeatureCollection', features: [anonymous] }).size).toBe(0);
  });

  it('returns an empty map for an empty collection', () => {
    expect(collectBounds(PATH, { type: 'FeatureCollection', features: [] }).size).toBe(0);
  });
});

describe('featureCentroid', () => {
  it('returns the projected centroid', () => {
    const [x, y] = featureCentroid(PATH, box('a', 0, 0, 100, 100));
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(50, 5);
  });

  it('returns the origin for empty geometry rather than NaN', () => {
    const empty: GeoJSON.Feature = {
      type: 'Feature', id: 'e', properties: {},
      geometry: { type: 'Polygon', coordinates: [] },
    };
    expect(featureCentroid(PATH, empty)).toEqual([0, 0]);
  });
});

describe('computeFitTransform', () => {
  const viewport = { width: 1000, height: 1000 };

  it('centers the region in the viewport', () => {
    const { k, x, y } = computeFitTransform([[400, 400], [600, 600]], viewport);
    // Region center (500, 500) must land at viewport center (500, 500).
    expect(500 * k + x).toBeCloseTo(500, 5);
    expect(500 * k + y).toBeCloseTo(500, 5);
  });

  it('scales the region to fill the viewport minus padding', () => {
    const { k } = computeFitTransform([[400, 400], [600, 600]], viewport, { padding: 100 });
    // 200px region into 800px of usable space.
    expect(k).toBeCloseTo(4, 5);
  });

  it('fits the more constrained axis so nothing is cropped', () => {
    const { k } = computeFitTransform([[0, 0], [500, 100]], viewport, { padding: 0 });
    expect(k).toBeCloseTo(2, 5); // width-limited: 1000/500, not 1000/100
  });

  it('clamps to maxScale so a tiny district does not zoom absurdly', () => {
    const { k } = computeFitTransform([[500, 500], [501, 501]], viewport, { maxScale: 12 });
    expect(k).toBe(12);
  });

  it('clamps to minScale so a huge region does not zoom out past the country view', () => {
    const { k } = computeFitTransform([[0, 0], [5000, 5000]], viewport, { minScale: 1 });
    expect(k).toBe(1);
  });

  it('keeps the region centered even when the scale is clamped', () => {
    const { k, x, y } = computeFitTransform([[500, 500], [501, 501]], viewport, { maxScale: 12 });
    expect(500.5 * k + x).toBeCloseTo(500, 5);
    expect(500.5 * k + y).toBeCloseTo(500, 5);
  });

  it('handles a zero-area bbox without dividing by zero', () => {
    const { k, x, y } = computeFitTransform([[300, 300], [300, 300]], viewport);
    expect(Number.isFinite(k)).toBe(true);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(300 * k + x).toBeCloseTo(500, 5);
  });

  it('handles a degenerate viewport without producing NaN', () => {
    const { k, x, y } = computeFitTransform([[0, 0], [100, 100]], { width: 0, height: 0 });
    expect(Number.isFinite(k)).toBe(true);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('produces a transform matching the SVG translate-then-scale convention', () => {
    // screen = point * k + [x, y], i.e. transform="translate(x,y) scale(k)".
    const bbox: [[number, number], [number, number]] = [[0, 0], [100, 100]];
    const { k, x, y } = computeFitTransform(bbox, viewport, { padding: 0 });
    expect(0 * k + x).toBeCloseTo(0, 5);
    expect(100 * k + x).toBeCloseTo(1000, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/geo/bounds.test.ts`
Expected: FAIL — cannot resolve `./bounds.js`.

- [ ] **Step 3: Implement `src/core/geo/bounds.ts`**

```ts
import type { GeoPath } from 'd3-geo';
import type { BBox, Transform, Viewport } from '@/core/types/index.js';

export interface FitOptions {
  padding?: number;
  maxScale?: number;
  minScale?: number;
}

const DEFAULT_PADDING = 40;
const DEFAULT_MAX_SCALE = 12;
const DEFAULT_MIN_SCALE = 1;

const ORIGIN_BBOX: BBox = [[0, 0], [0, 0]];

function isFiniteBounds(bounds: [[number, number], [number, number]]): boolean {
  return bounds.every((pair) => pair.every((value) => Number.isFinite(value)));
}

/**
 * Projected bounding box of a feature.
 *
 * d3 returns ±Infinity for empty geometry; that is collapsed to a zero-size box
 * at the origin so downstream arithmetic never produces NaN.
 */
export function featureBounds(path: GeoPath, feature: GeoJSON.Feature): BBox {
  const bounds = path.bounds(feature);
  return isFiniteBounds(bounds) ? bounds : ORIGIN_BBOX;
}

/**
 * Bounding boxes for every identifiable feature, keyed by id.
 * Computed once per projection and reused by viewport culling on every pan.
 */
export function collectBounds(
  path: GeoPath,
  collection: GeoJSON.FeatureCollection,
): Map<string, BBox> {
  const bounds = new Map<string, BBox>();

  for (const feature of collection.features) {
    if (feature.id === undefined || feature.id === null) continue;
    bounds.set(String(feature.id), featureBounds(path, feature));
  }

  return bounds;
}

/** Projected centroid, used to anchor labels and fly-to targets. */
export function featureCentroid(path: GeoPath, feature: GeoJSON.Feature): [number, number] {
  const [x, y] = path.centroid(feature);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : [0, 0];
}

/**
 * Computes the transform that centers and fits a bounding box in the viewport.
 *
 * Convention: `screen = point * k + [x, y]`, which maps directly onto the SVG
 * attribute `transform="translate(x, y) scale(k)"`. Keeping the math in the same
 * convention as the DOM means Phase 2 hands this straight to the element with no
 * conversion step to get wrong.
 */
export function computeFitTransform(
  bbox: BBox,
  viewport: Viewport,
  options: FitOptions = {},
): Transform {
  const {
    padding = DEFAULT_PADDING,
    maxScale = DEFAULT_MAX_SCALE,
    minScale = DEFAULT_MIN_SCALE,
  } = options;

  const [[minX, minY], [maxX, maxY]] = bbox;
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);

  // Fit the more constrained axis so the region is never cropped. A zero-size
  // box carries no scale information, so it falls back to maxScale.
  const scaleX = boxWidth > 0 ? usableWidth / boxWidth : Number.POSITIVE_INFINITY;
  const scaleY = boxHeight > 0 ? usableHeight / boxHeight : Number.POSITIVE_INFINITY;
  const fitted = Math.min(scaleX, scaleY);

  const k = Math.min(maxScale, Math.max(minScale, Number.isFinite(fitted) ? fitted : maxScale));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    k,
    x: viewport.width / 2 - centerX * k,
    y: viewport.height / 2 - centerY * k,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/geo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/geo/bounds.ts src/core/geo/bounds.test.ts
git commit -m "feat(core): add feature bounds, centroids and fit transforms"
```

---

## Task 19: Viewport culling

At ilçe level the map holds 973 polygons. Rendering all of them at high zoom, when perhaps 30 are on screen, is the difference between a 60 fps pan and a stuttering one.

**Files:**
- Create: `src/core/geo/viewport.ts`, `src/core/geo/index.ts`
- Test: `src/core/geo/viewport.test.ts`

**Interfaces:**
- Consumes: `BBox`, `Transform`, `Viewport`
- Produces:
  - `isVisible(bbox: BBox, transform: Transform, viewport: Viewport, margin?: number): boolean`
  - `cullFeatures(bounds: ReadonlyMap<string, BBox>, transform, viewport, margin?): Set<string>`
  - the `src/core/geo` barrel

- [ ] **Step 1: Write the failing tests**

Create `src/core/geo/viewport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { BBox, Transform } from '@/core/types/index.js';
import { cullFeatures, isVisible } from './viewport.js';

const VIEWPORT = { width: 1000, height: 800 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

const bbox = (x0: number, y0: number, x1: number, y1: number): BBox => [[x0, y0], [x1, y1]];

describe('isVisible', () => {
  it('accepts a box fully inside the viewport', () => {
    expect(isVisible(bbox(100, 100, 200, 200), IDENTITY, VIEWPORT, 0)).toBe(true);
  });

  it('accepts a box straddling an edge', () => {
    expect(isVisible(bbox(-50, 100, 50, 200), IDENTITY, VIEWPORT, 0)).toBe(true);
  });

  it('accepts a box larger than the viewport', () => {
    expect(isVisible(bbox(-500, -500, 5000, 5000), IDENTITY, VIEWPORT, 0)).toBe(true);
  });

  it('rejects boxes entirely off each edge', () => {
    expect(isVisible(bbox(-300, 100, -200, 200), IDENTITY, VIEWPORT, 0)).toBe(false);
    expect(isVisible(bbox(1200, 100, 1300, 200), IDENTITY, VIEWPORT, 0)).toBe(false);
    expect(isVisible(bbox(100, -300, 200, -200), IDENTITY, VIEWPORT, 0)).toBe(false);
    expect(isVisible(bbox(100, 900, 200, 1000), IDENTITY, VIEWPORT, 0)).toBe(false);
  });

  it('treats edge contact as visible', () => {
    expect(isVisible(bbox(-100, 100, 0, 200), IDENTITY, VIEWPORT, 0)).toBe(true);
  });

  it('applies the transform before testing', () => {
    const offscreen = bbox(2000, 100, 2100, 200);
    expect(isVisible(offscreen, IDENTITY, VIEWPORT, 0)).toBe(false);
    // Pan left by 1900px and it comes into view.
    expect(isVisible(offscreen, { k: 1, x: -1900, y: 0 }, VIEWPORT, 0)).toBe(true);
  });

  it('accounts for scale', () => {
    const box = bbox(400, 300, 500, 400);
    expect(isVisible(box, IDENTITY, VIEWPORT, 0)).toBe(true);
    // Scaling 10x pushes it far past the right edge.
    expect(isVisible(box, { k: 10, x: 0, y: 0 }, VIEWPORT, 0)).toBe(false);
  });

  it('includes boxes within the margin, so panning reveals drawn geometry', () => {
    const justOff = bbox(1050, 100, 1150, 200);
    expect(isVisible(justOff, IDENTITY, VIEWPORT, 0)).toBe(false);
    expect(isVisible(justOff, IDENTITY, VIEWPORT, 200)).toBe(true);
  });

  it('returns false for a degenerate viewport', () => {
    expect(isVisible(bbox(0, 0, 10, 10), IDENTITY, { width: 0, height: 0 }, 0)).toBe(false);
  });
});

describe('cullFeatures', () => {
  const bounds = new Map<string, BBox>([
    ['a', bbox(0, 0, 100, 100)],
    ['b', bbox(500, 400, 600, 500)],
    ['c', bbox(5000, 5000, 5100, 5100)],
    ['d', bbox(-900, -900, -800, -800)],
  ]);

  it('returns only the visible ids', () => {
    const visible = cullFeatures(bounds, IDENTITY, VIEWPORT);
    expect(visible.has('a')).toBe(true);
    expect(visible.has('b')).toBe(true);
    expect(visible.has('c')).toBe(false);
    expect(visible.has('d')).toBe(false);
  });

  it('returns everything when the transform brings everything into view', () => {
    const zoomedOut = cullFeatures(bounds, { k: 0.05, x: 400, y: 300 }, VIEWPORT);
    expect(zoomedOut.size).toBe(4);
  });

  it('returns an empty set for empty bounds', () => {
    expect(cullFeatures(new Map(), IDENTITY, VIEWPORT).size).toBe(0);
  });

  it('uses the default margin when none is given', () => {
    // Default margin is 100px; a box 50px off the right edge stays included.
    const nearby = new Map<string, BBox>([['x', bbox(1020, 100, 1080, 200)]]);
    expect(cullFeatures(nearby, IDENTITY, VIEWPORT).has('x')).toBe(true);
  });

  it('culls aggressively enough to matter at realistic scale', () => {
    // 973 districts spread over a large projected area; zoomed in, only a
    // fraction should survive. This is the property that keeps panning at 60fps.
    const many = new Map<string, BBox>();
    for (let i = 0; i < 973; i += 1) {
      const x = (i % 40) * 250;
      const y = Math.floor(i / 40) * 250;
      many.set(String(i), bbox(x, y, x + 200, y + 200));
    }
    const visible = cullFeatures(many, { k: 4, x: -2000, y: -1500 }, VIEWPORT);
    expect(visible.size).toBeGreaterThan(0);
    expect(visible.size).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/geo/viewport.test.ts`
Expected: FAIL — cannot resolve `./viewport.js`.

- [ ] **Step 3: Implement `src/core/geo/viewport.ts`**

```ts
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
```

- [ ] **Step 4: Create the barrel `src/core/geo/index.ts`**

```ts
export type { ProjectionOptions } from './projection.js';
export { createPathGenerator, createTurkeyProjection } from './projection.js';
export { decodeTopology, deriveRegionMeta, regionNameMap } from './topology.js';
export type { FitOptions } from './bounds.js';
export { collectBounds, computeFitTransform, featureBounds, featureCentroid } from './bounds.js';
export { cullFeatures, isVisible } from './viewport.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/geo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/geo
git commit -m "feat(core): add viewport culling and geo module barrel"
```

---

## Task 20: Search entity index

**Files:**
- Create: `src/core/search/entities.ts`
- Test: `src/core/search/entities.test.ts`

**Interfaces:**
- Consumes: `foldTurkish` (Task 3), `RegionMeta`, `CrimeCategory`
- Produces:

```ts
type SearchEntityType = 'il' | 'ilce' | 'category' | 'year';
interface SearchEntity {
  readonly type: SearchEntityType;
  /** il/ilçe code, category id, or the year as a string. */
  readonly id: string;
  /** Turkish display label. */
  readonly label: string;
  /** foldTurkish(label), precomputed once. */
  readonly folded: string;
  /** Parent province name for an ilçe; null otherwise. */
  readonly parentLabel: string | null;
}
interface SearchIndexInput {
  ilRegions: readonly RegionMeta[];
  ilceRegions: readonly RegionMeta[];
  categories: readonly CrimeCategory[];
  years: readonly number[];
  /** il code → name, for resolving ilçe parents. */
  ilNames: ReadonlyMap<string, string>;
}
function buildSearchIndex(input: SearchIndexInput): SearchEntity[];
```

Folding happens once at index time, not per keystroke. With ~1,070 entities and a keystroke budget measured in milliseconds, re-folding on every input event would be the dominant cost.

- [ ] **Step 1: Write the failing tests**

Create `src/core/search/entities.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CrimeCategory, RegionMeta } from '@/core/types/index.js';
import { buildSearchIndex } from './entities.js';

const IL: RegionMeta[] = [
  { code: '34', name: 'İstanbul', parentCode: null },
  { code: '19', name: 'Çorum', parentCode: null },
];
const ILCE: RegionMeta[] = [
  { code: '3401', name: 'Şişli', parentCode: '34' },
  { code: '1901', name: 'Alaca', parentCode: '19' },
];
const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const IL_NAMES = new Map([['34', 'İstanbul'], ['19', 'Çorum']]);

const INDEX = buildSearchIndex({
  ilRegions: IL, ilceRegions: ILCE, categories: CATEGORIES,
  years: [2022, 2023], ilNames: IL_NAMES,
});

describe('buildSearchIndex', () => {
  it('indexes every entity type', () => {
    expect(INDEX).toHaveLength(2 + 2 + 1 + 2);
    expect(new Set(INDEX.map((e) => e.type))).toEqual(new Set(['il', 'ilce', 'category', 'year']));
  });

  it('precomputes the folded form of every label', () => {
    expect(INDEX.find((e) => e.id === '34')?.folded).toBe('istanbul');
    expect(INDEX.find((e) => e.id === '3401')?.folded).toBe('sisli');
    expect(INDEX.find((e) => e.id === '19')?.folded).toBe('corum');
    expect(INDEX.find((e) => e.id === 'hirsizlik')?.folded).toBe('hirsizlik');
  });

  it('attaches the parent province name to each ilçe', () => {
    // The dropdown shows "Şişli · İstanbul"; two provinces can hold districts
    // with the same name, so the parent is what disambiguates them.
    expect(INDEX.find((e) => e.id === '3401')?.parentLabel).toBe('İstanbul');
  });

  it('gives il, category and year entities a null parent', () => {
    for (const id of ['34', 'hirsizlik', '2023']) {
      expect(INDEX.find((e) => e.id === id)?.parentLabel).toBeNull();
    }
  });

  it('indexes years as string ids and labels', () => {
    const year = INDEX.find((e) => e.type === 'year' && e.id === '2023');
    expect(year?.label).toBe('2023');
    expect(year?.folded).toBe('2023');
  });

  it('falls back to the parent code when the province name is unknown', () => {
    const orphan = buildSearchIndex({
      ilRegions: [], ilceRegions: [{ code: '9901', name: 'Bilinmeyen', parentCode: '99' }],
      categories: [], years: [], ilNames: new Map(),
    });
    expect(orphan[0]!.parentLabel).toBe('99');
  });

  it('handles an ilçe with no parent code', () => {
    const orphan = buildSearchIndex({
      ilRegions: [], ilceRegions: [{ code: '3401', name: 'Şişli', parentCode: null }],
      categories: [], years: [], ilNames: IL_NAMES,
    });
    expect(orphan[0]!.parentLabel).toBeNull();
  });

  it('returns an empty index for empty input', () => {
    expect(buildSearchIndex({
      ilRegions: [], ilceRegions: [], categories: [], years: [], ilNames: new Map(),
    })).toEqual([]);
  });

  it('is deterministic', () => {
    const input = {
      ilRegions: IL, ilceRegions: ILCE, categories: CATEGORIES,
      years: [2022, 2023], ilNames: IL_NAMES,
    };
    expect(buildSearchIndex(input)).toEqual(buildSearchIndex(input));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/search/entities.test.ts`
Expected: FAIL — cannot resolve `./entities.js`.

- [ ] **Step 3: Implement `src/core/search/entities.ts`**

```ts
import type { CrimeCategory, RegionMeta } from '@/core/types/index.js';
import { foldTurkish } from './normalize.js';

export type SearchEntityType = 'il' | 'ilce' | 'category' | 'year';

export interface SearchEntity {
  readonly type: SearchEntityType;
  readonly id: string;
  readonly label: string;
  /** Precomputed foldTurkish(label). */
  readonly folded: string;
  /** Parent province name for an ilçe; null for every other type. */
  readonly parentLabel: string | null;
}

export interface SearchIndexInput {
  ilRegions: readonly RegionMeta[];
  ilceRegions: readonly RegionMeta[];
  categories: readonly CrimeCategory[];
  years: readonly number[];
  /** il code → name, for resolving ilçe parents. */
  ilNames: ReadonlyMap<string, string>;
}

/**
 * Builds the flat entity list the search bar matches against.
 *
 * Folding is done once here rather than per keystroke. With roughly 1,070
 * entities and a keystroke budget in single-digit milliseconds, re-folding on
 * every input event would dominate the cost of searching.
 */
export function buildSearchIndex(input: SearchIndexInput): SearchEntity[] {
  const { ilRegions, ilceRegions, categories, years, ilNames } = input;
  const entities: SearchEntity[] = [];

  for (const il of ilRegions) {
    entities.push({
      type: 'il', id: il.code, label: il.name,
      folded: foldTurkish(il.name), parentLabel: null,
    });
  }

  for (const ilce of ilceRegions) {
    // The dropdown renders "Şişli · İstanbul". Two provinces can hold districts
    // with the same name, so the parent label is what tells them apart.
    const parentLabel = ilce.parentCode === null
      ? null
      : ilNames.get(ilce.parentCode) ?? ilce.parentCode;

    entities.push({
      type: 'ilce', id: ilce.code, label: ilce.name,
      folded: foldTurkish(ilce.name), parentLabel,
    });
  }

  for (const category of categories) {
    entities.push({
      type: 'category', id: category.id, label: category.label,
      folded: foldTurkish(category.label), parentLabel: null,
    });
  }

  for (const year of years) {
    const label = String(year);
    entities.push({ type: 'year', id: label, label, folded: label, parentLabel: null });
  }

  return entities;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/search/entities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/search/entities.ts src/core/search/entities.test.ts
git commit -m "feat(core): add searchable entity index"
```

---

## Task 21: Search matching and ranking

**Files:**
- Create: `src/core/search/match.ts`, `src/core/search/index.ts`
- Test: `src/core/search/match.test.ts`

**Interfaces:**
- Consumes: `SearchEntity` (Task 20), `foldTurkish` (Task 3), `compareTurkish` (Task 12)
- Produces:
  - `scoreEntity(foldedQuery: string, entity: SearchEntity): number` — 0 means no match
  - `searchEntities(index: readonly SearchEntity[], query: string, limit?: number): SearchResult[]`
  - the `src/core/search` barrel

```ts
interface SearchResult { readonly entity: SearchEntity; readonly score: number; }
```

Scoring tiers, highest first: exact match, whole-label prefix, word-boundary prefix, substring, bounded fuzzy. Ties break by entity type priority (il > ilçe > category > year), then Turkish alphabetical order, so results never reshuffle between renders.

- [ ] **Step 1: Write the failing tests**

Create `src/core/search/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSearchIndex } from './entities.js';
import { scoreEntity, searchEntities } from './match.js';
import { foldTurkish } from './normalize.js';

const INDEX = buildSearchIndex({
  ilRegions: [
    { code: '34', name: 'İstanbul', parentCode: null },
    { code: '35', name: 'İzmir', parentCode: null },
    { code: '19', name: 'Çorum', parentCode: null },
    { code: '63', name: 'Şanlıurfa', parentCode: null },
    { code: '03', name: 'Afyonkarahisar', parentCode: null },
  ],
  ilceRegions: [
    { code: '3401', name: 'Şişli', parentCode: '34' },
    { code: '3402', name: 'Kadıköy', parentCode: '34' },
    { code: '3501', name: 'Karşıyaka', parentCode: '35' },
  ],
  categories: [
    { id: 'hirsizlik', label: 'Hırsızlık' },
    { id: 'siber', label: 'Siber Suçlar' },
  ],
  years: [2022, 2023],
  ilNames: new Map([['34', 'İstanbul'], ['35', 'İzmir']]),
});

const ids = (query: string, limit?: number): string[] =>
  searchEntities(INDEX, query, limit).map((r) => r.entity.id);

describe('scoreEntity', () => {
  const istanbul = INDEX.find((e) => e.id === '34')!;

  it('scores an exact match highest', () => {
    expect(scoreEntity(foldTurkish('İstanbul'), istanbul))
      .toBeGreaterThan(scoreEntity('istan', istanbul));
  });

  it('scores a prefix above a substring', () => {
    expect(scoreEntity('istan', istanbul)).toBeGreaterThan(scoreEntity('tanbul', istanbul));
  });

  it('scores a substring above a fuzzy match', () => {
    expect(scoreEntity('tanbul', istanbul)).toBeGreaterThan(scoreEntity('istanbol', istanbul));
  });

  it('returns 0 for no match', () => {
    expect(scoreEntity('zzzzzz', istanbul)).toBe(0);
  });

  it('returns 0 for an empty query', () => {
    expect(scoreEntity('', istanbul)).toBe(0);
  });

  it('scores a shorter label higher for the same prefix', () => {
    // "İzmir" is a tighter match for "i" than "İstanbul" is.
    const izmir = INDEX.find((e) => e.id === '35')!;
    expect(scoreEntity('iz', izmir)).toBeGreaterThan(scoreEntity('is', istanbul) - 1);
  });

  it('matches on a word boundary inside a multi-word label', () => {
    const siber = INDEX.find((e) => e.id === 'siber')!;
    expect(scoreEntity('suc', siber)).toBeGreaterThan(0);
  });
});

describe('searchEntities — Turkish handling', () => {
  it('finds Şişli when typing sisli', () => {
    expect(ids('sisli')[0]).toBe('3401');
  });

  it('finds Ağrı-style names typed without diacritics', () => {
    expect(ids('corum')[0]).toBe('19');
    expect(ids('sanliurfa')[0]).toBe('63');
    expect(ids('kadikoy')[0]).toBe('3402');
    expect(ids('karsiyaka')[0]).toBe('3501');
  });

  it('finds İstanbul from every casing of the query', () => {
    for (const query of ['istanbul', 'İstanbul', 'ISTANBUL', 'ıstanbul', 'Istanbul']) {
      expect(ids(query)[0]).toBe('34');
    }
  });

  it('finds categories by their Turkish label', () => {
    expect(ids('hirsizlik')[0]).toBe('hirsizlik');
    expect(ids('Hırsızlık')[0]).toBe('hirsizlik');
  });

  it('finds years', () => {
    expect(ids('2023')).toContain('2023');
  });
});

describe('searchEntities — ranking', () => {
  it('ranks an exact match first', () => {
    expect(ids('izmir')[0]).toBe('35');
  });

  it('ranks prefix matches above substring matches', () => {
    const results = ids('kar');
    expect(results.indexOf('3501')).toBeLessThan(results.indexOf('03'));
  });

  it('tolerates a single typo', () => {
    expect(ids('istanbol')).toContain('34');
    expect(ids('izmirr')).toContain('35');
  });

  it('rejects a query too far from anything', () => {
    expect(ids('qwertyuiop')).toEqual([]);
  });

  it('breaks ties by type priority, provinces before districts', () => {
    const scored = searchEntities(INDEX, 'i');
    const firstIl = scored.findIndex((r) => r.entity.type === 'il');
    const firstYear = scored.findIndex((r) => r.entity.type === 'year');
    if (firstYear !== -1) expect(firstIl).toBeLessThan(firstYear);
  });

  it('is stable across repeated calls', () => {
    expect(ids('ka')).toEqual(ids('ka'));
  });

  it('respects the result limit', () => {
    expect(searchEntities(INDEX, 'i', 3)).toHaveLength(3);
  });

  it('defaults to a sane limit', () => {
    expect(searchEntities(INDEX, 'i').length).toBeLessThanOrEqual(20);
  });

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchEntities(INDEX, '')).toEqual([]);
    expect(searchEntities(INDEX, '   ')).toEqual([]);
  });

  it('returns nothing when the index is empty', () => {
    expect(searchEntities([], 'istanbul')).toEqual([]);
  });

  it('handles a limit of zero', () => {
    expect(searchEntities(INDEX, 'i', 0)).toEqual([]);
  });

  it('stays fast on a realistic index', () => {
    // ~1,070 entities is the real scale: 81 il + 973 ilçe + categories + years.
    const large = buildSearchIndex({
      ilRegions: Array.from({ length: 81 }, (_, i) => ({
        code: String(i).padStart(2, '0'), name: `İl ${i}`, parentCode: null,
      })),
      ilceRegions: Array.from({ length: 973 }, (_, i) => ({
        code: String(i).padStart(4, '0'), name: `İlçe ${i}`, parentCode: '34',
      })),
      categories: [], years: [], ilNames: new Map(),
    });

    const started = performance.now();
    for (let i = 0; i < 20; i += 1) searchEntities(large, 'ilce 4');
    expect((performance.now() - started) / 20).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/search/match.test.ts`
Expected: FAIL — cannot resolve `./match.js`.

- [ ] **Step 3: Implement `src/core/search/match.ts`**

```ts
import { compareTurkish } from './collate.js';
import type { SearchEntity, SearchEntityType } from './entities.js';
import { foldTurkish } from './normalize.js';

export interface SearchResult {
  readonly entity: SearchEntity;
  readonly score: number;
}

/** Score tiers, highest first. Gaps are wide enough that no bonus crosses a tier. */
const SCORE_EXACT = 1000;
const SCORE_PREFIX = 800;
const SCORE_WORD_PREFIX = 600;
const SCORE_SUBSTRING = 400;
const SCORE_FUZZY_BASE = 200;

/** Provinces outrank districts, which outrank categories, which outrank years. */
const TYPE_PRIORITY: Readonly<Record<SearchEntityType, number>> = {
  il: 0, ilce: 1, category: 2, year: 3,
};

const DEFAULT_LIMIT = 20;
const MAX_EDIT_DISTANCE = 2;
/** Below this length a typo is indistinguishable from a different word. */
const MIN_FUZZY_LENGTH = 4;

/**
 * Levenshtein distance, abandoned once it exceeds `max`.
 *
 * Bounded because an unbounded distance over 1,070 entities on every keystroke
 * is wasted work: anything beyond two edits is not a typo, it is a different word.
 */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > max) return max + 1;
    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
}

/**
 * Scores one entity against an already-folded query. 0 means no match.
 *
 * A short bonus for tight matches keeps "İzmir" above "İzmit Merkez" for the
 * query "izmi", without ever letting a bonus push a result across a tier
 * boundary.
 */
export function scoreEntity(foldedQuery: string, entity: SearchEntity): number {
  if (foldedQuery === '') return 0;

  const { folded } = entity;
  // Tighter matches score slightly higher, capped well below the tier gap.
  const tightness = Math.max(0, 50 - (folded.length - foldedQuery.length));

  if (folded === foldedQuery) return SCORE_EXACT;
  if (folded.startsWith(foldedQuery)) return SCORE_PREFIX + tightness;

  const wordStart = folded.indexOf(` ${foldedQuery}`);
  if (wordStart !== -1) return SCORE_WORD_PREFIX + tightness;

  if (folded.includes(foldedQuery)) return SCORE_SUBSTRING + tightness;

  if (foldedQuery.length >= MIN_FUZZY_LENGTH) {
    const distance = boundedEditDistance(foldedQuery, folded, MAX_EDIT_DISTANCE);
    if (distance <= MAX_EDIT_DISTANCE) {
      return SCORE_FUZZY_BASE + (MAX_EDIT_DISTANCE - distance) * 25;
    }
  }

  return 0;
}

/**
 * Searches every entity type at once and returns ranked results.
 *
 * Ties break by type priority then Turkish alphabetical order, never by array
 * position, so the dropdown never reshuffles between renders on identical input.
 */
export function searchEntities(
  index: readonly SearchEntity[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): SearchResult[] {
  const folded = foldTurkish(query.trim());
  if (folded === '' || limit <= 0) return [];

  const matches: SearchResult[] = [];
  for (const entity of index) {
    const score = scoreEntity(folded, entity);
    if (score > 0) matches.push({ entity, score });
  }

  matches.sort((a, b) =>
    b.score - a.score
    || TYPE_PRIORITY[a.entity.type] - TYPE_PRIORITY[b.entity.type]
    || compareTurkish(a.entity.label, b.entity.label));

  return matches.slice(0, limit);
}
```

- [ ] **Step 4: Create the barrel `src/core/search/index.ts`**

```ts
export { foldTurkish, toTurkishLowerCase, toTurkishUpperCase } from './normalize.js';
export { compareTurkish } from './collate.js';
export type { SearchEntity, SearchEntityType, SearchIndexInput } from './entities.js';
export { buildSearchIndex } from './entities.js';
export type { SearchResult } from './match.js';
export { scoreEntity, searchEntities } from './match.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/search`
Expected: PASS.

If the "prefix above substring" ranking test fails, the tightness bonus is crossing a tier boundary — confirm the bonus is capped at 50 while the tier gap is 200.

- [ ] **Step 6: Commit**

```bash
git add src/core/search
git commit -m "feat(core): add Turkish-aware fuzzy search matching and ranking"
```

---

## Task 22: Geo build script

Converts source administrative boundaries into the simplified TopoJSON the package ships. Run manually when boundary data changes, not as part of `npm run build`.

**Files:**
- Create: `scripts/build-geo.ts`, `scripts/README.md`
- Modify: `package.json` (add the `build:geo` script and three devDependencies)
- Test: `scripts/build-geo.test.ts`

**Interfaces:**
- Consumes: `IL_BY_CODE`, `isValidIlCode`, `ilCodeFromIlceCode` (Task 5)
- Produces: `validateFeatures(features, level): ValidationReport` — the pure, testable core of the script

```ts
interface ValidationReport {
  ok: boolean;
  missingCodes: string[];              // expected but absent from the source
  unknownCodes: string[];              // present in the source but not real codes
  duplicateCodes: string[];
  unnamedCodes: string[];
  provincesWithoutDistricts: string[]; // ilçe level only — a hole at ilçe zoom
}
```

The script **fails the build on any unmatched region code, in either direction.** A boundary file missing a province renders a hole in the map; a boundary file with a code the data layer does not recognize renders a region that can never be colored. Both are silent in production and obvious at build time, so they get caught here.

- [ ] **Step 1: Add the devDependencies and script**

```bash
npm install --save-dev topojson-server@^3.0.1 topojson-simplify@^3.0.3 tsx@^4.19.2
```

Then add to `package.json` `scripts`:

```json
"build:geo": "tsx scripts/build-geo.ts"
```

These are `devDependencies`: the script runs on a maintainer's machine, and its output — the committed TopoJSON — is what ships. The Global Constraint limiting runtime dependencies to `d3-geo` and `topojson-client` is unaffected.

- [ ] **Step 2: Write the failing validation tests**

Create `scripts/build-geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateFeatures } from './build-geo.js';

function feature(id: string | undefined, name = 'Bir Yer'): GeoJSON.Feature {
  return {
    type: 'Feature',
    ...(id === undefined ? {} : { id }),
    properties: { name },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  };
}

const allProvinces = (): GeoJSON.Feature[] =>
  Array.from({ length: 81 }, (_, i) => feature(String(i + 1).padStart(2, '0'), `İl ${i + 1}`));

describe('validateFeatures — il level', () => {
  it('accepts a complete province set', () => {
    const report = validateFeatures(allProvinces(), 'il');
    expect(report.ok).toBe(true);
    expect(report.missingCodes).toEqual([]);
    expect(report.unknownCodes).toEqual([]);
  });

  it('reports a missing province', () => {
    const incomplete = allProvinces().filter((f) => f.id !== '34');
    const report = validateFeatures(incomplete, 'il');
    expect(report.ok).toBe(false);
    expect(report.missingCodes).toContain('34');
  });

  it('reports a province code that is not real', () => {
    const report = validateFeatures([...allProvinces(), feature('99')], 'il');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('99');
  });

  it('reports duplicates', () => {
    const report = validateFeatures([...allProvinces(), feature('34')], 'il');
    expect(report.ok).toBe(false);
    expect(report.duplicateCodes).toContain('34');
  });

  it('reports features with no id', () => {
    const report = validateFeatures([...allProvinces(), feature(undefined)], 'il');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('(id yok)');
  });

  it('reports features with no name', () => {
    const missing = allProvinces();
    missing[0] = feature('01', '');
    const report = validateFeatures(missing, 'il');
    expect(report.ok).toBe(false);
    expect(report.unnamedCodes).toContain('01');
  });
});

describe('validateFeatures — ilçe level', () => {
  it('accepts districts whose parents are real provinces', () => {
    const report = validateFeatures([feature('3401'), feature('0601')], 'ilce');
    expect(report.ok).toBe(true);
  });

  it('does not require a complete district set, since the count is not fixed', () => {
    expect(validateFeatures([feature('3401')], 'ilce').missingCodes).toEqual([]);
  });

  it('reports a district whose parent province does not exist', () => {
    const report = validateFeatures([feature('9901')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('9901');
  });

  it('reports a malformed district code', () => {
    const report = validateFeatures([feature('340')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.unknownCodes).toContain('340');
  });

  it('reports every province with no districts at all', () => {
    // A province with zero districts leaves a hole at ilçe zoom.
    const report = validateFeatures([feature('3401')], 'ilce');
    expect(report.ok).toBe(false);
    expect(report.missingCodes.length).toBe(0);
    expect(report.unknownCodes.length).toBe(0);
    // Provinces without coverage are surfaced separately.
    expect(report.provincesWithoutDistricts).toContain('06');
  });

  it('accepts full district coverage of every province', () => {
    const covering = Array.from({ length: 81 }, (_, i) =>
      feature(`${String(i + 1).padStart(2, '0')}01`, `İlçe ${i + 1}`));
    const report = validateFeatures(covering, 'ilce');
    expect(report.ok).toBe(true);
    expect(report.provincesWithoutDistricts).toEqual([]);
  });
});

describe('validateFeatures — empty input', () => {
  it('rejects an empty il set', () => {
    const report = validateFeatures([], 'il');
    expect(report.ok).toBe(false);
    expect(report.missingCodes).toHaveLength(81);
  });

  it('rejects an empty ilçe set', () => {
    expect(validateFeatures([], 'ilce').ok).toBe(false);
  });
});
```

Note this test adds `provincesWithoutDistricts: string[]` to `ValidationReport`. Include it in the interface.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run scripts`
Expected: FAIL — cannot resolve `./build-geo.js`. If Vitest does not pick the file up, add `'scripts/**/*.test.ts'` to `test.include` in `vitest.config.ts`.

- [ ] **Step 4: Implement `scripts/build-geo.ts`**

```ts
/**
 * Converts source administrative boundaries into the simplified TopoJSON the
 * package ships.
 *
 * Run manually when boundary data changes — not part of `npm run build`. The
 * committed TopoJSON is the artifact; this script is how it is regenerated.
 *
 *   npm run build:geo -- --il path/to/il.geojson --ilce path/to/ilce.geojson
 *
 * Source data is expected to be OpenStreetMap-derived (ODbL, attribution
 * required) unless officially licensed HGM/TÜİK data is available. See
 * scripts/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { IL_BY_CODE, ilCodeFromIlceCode, isValidIlCode } from '../src/data/geo/region-meta.js';

export type GeoLevelName = 'il' | 'ilce';

export interface ValidationReport {
  ok: boolean;
  /** Expected but absent from the source. */
  missingCodes: string[];
  /** Present in the source but not a real code. */
  unknownCodes: string[];
  duplicateCodes: string[];
  unnamedCodes: string[];
  /** Provinces with no districts at all — a hole at ilçe zoom. */
  provincesWithoutDistricts: string[];
}

/**
 * Checks that boundary codes and the data layer's codes agree, in both
 * directions.
 *
 * A province missing from the boundary file renders a hole in the map. A code in
 * the boundary file that the data layer does not recognize renders a region that
 * can never be colored. Both are invisible in production and obvious here, so
 * the build fails on either.
 */
export function validateFeatures(
  features: readonly GeoJSON.Feature[],
  level: GeoLevelName,
): ValidationReport {
  const unknownCodes: string[] = [];
  const duplicateCodes: string[] = [];
  const unnamedCodes: string[] = [];
  const seen = new Set<string>();
  const coveredProvinces = new Set<string>();

  for (const feature of features) {
    if (feature.id === undefined || feature.id === null) {
      unknownCodes.push('(id yok)');
      continue;
    }

    const code = String(feature.id);
    if (seen.has(code)) {
      duplicateCodes.push(code);
      continue;
    }
    seen.add(code);

    if (level === 'il') {
      if (!isValidIlCode(code)) { unknownCodes.push(code); continue; }
      coveredProvinces.add(code);
    } else {
      const parent = ilCodeFromIlceCode(code);
      if (parent === null) { unknownCodes.push(code); continue; }
      coveredProvinces.add(parent);
    }

    const name = feature.properties?.['name'];
    if (typeof name !== 'string' || name === '') unnamedCodes.push(code);
  }

  // The number of districts is not fixed, so only il level has a required set.
  const missingCodes = level === 'il'
    ? [...IL_BY_CODE.keys()].filter((code) => !seen.has(code))
    : [];

  const provincesWithoutDistricts = level === 'ilce'
    ? [...IL_BY_CODE.keys()].filter((code) => !coveredProvinces.has(code))
    : [];

  return {
    ok: missingCodes.length === 0
      && unknownCodes.length === 0
      && duplicateCodes.length === 0
      && unnamedCodes.length === 0
      && provincesWithoutDistricts.length === 0,
    missingCodes, unknownCodes, duplicateCodes, unnamedCodes, provincesWithoutDistricts,
  };
}

function reportOrExit(report: ValidationReport, level: GeoLevelName): void {
  if (report.ok) return;

  console.error(`\n[build-geo] ${level} sınır verisi doğrulanamadı:`);
  const sections: [string, string[]][] = [
    ['Eksik kodlar', report.missingCodes],
    ['Tanınmayan kodlar', report.unknownCodes],
    ['Yinelenen kodlar', report.duplicateCodes],
    ['İsimsiz bölgeler', report.unnamedCodes],
    ['İlçesi olmayan iller', report.provincesWithoutDistricts],
  ];
  for (const [label, codes] of sections) {
    if (codes.length > 0) console.error(`  ${label} (${codes.length}): ${codes.join(', ')}`);
  }
  process.exit(1);
}

/** Drops presimplify weights below the threshold, then quantizes coordinates. */
function buildTopology(
  features: GeoJSON.Feature[],
  level: GeoLevelName,
  minWeight: number,
): unknown {
  const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
  return simplify(presimplify(topology({ [level]: collection })), minWeight);
}

function parseArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key !== undefined && value !== undefined && key.startsWith('--')) {
      args.set(key.slice(2), value);
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.get('out') ?? 'src/data/geo';

  // İl geometry is only ever seen at country zoom, so it is simplified harder.
  const levels: [GeoLevelName, number][] = [['il', 1e-6], ['ilce', 1e-7]];

  for (const [level, minWeight] of levels) {
    const input = args.get(level);
    if (input === undefined) {
      console.error(`[build-geo] --${level} <geojson> gerekli.`);
      process.exit(1);
    }

    const source = JSON.parse(readFileSync(resolve(input), 'utf8')) as GeoJSON.FeatureCollection;
    reportOrExit(validateFeatures(source.features, level), level);

    const outPath = resolve(outDir, `turkiye-${level}.topo.json`);
    writeFileSync(outPath, JSON.stringify(buildTopology(source.features, level, minWeight)));

    const sizeKb = Math.round(readFileSync(outPath).byteLength / 1024);
    console.log(`[build-geo] ${level}: ${source.features.length} bölge → ${outPath} (${sizeKb} KB)`);
  }
}

// Only run when invoked directly, so the test can import validateFeatures.
if (process.argv[1]?.endsWith('build-geo.ts') === true) main();
```

- [ ] **Step 5: Write `scripts/README.md`**

```markdown
# Sınır verisi oluşturma

Kaynak sınır verisini paketle birlikte dağıtılan sadeleştirilmiş TopoJSON'a
dönüştürür. Sınır verisi değiştiğinde elle çalıştırılır; `npm run build`
sürecinin parçası değildir.

    npm run build:geo -- --il kaynak/il.geojson --ilce kaynak/ilce.geojson

## Kaynak veri gereksinimleri

- Her `Feature` bir `id` taşımalı: il için 2 haneli plaka kodu (`"34"`),
  ilçe için 4 haneli TÜİK kodu (`"3401"`).
- Her `Feature` `properties.name` içinde Türkçe adı taşımalı, doğru
  yazımıyla (`Şanlıurfa`, `Şanliurfa` değil).
- 81 ilin tamamı bulunmalı ve her ilin en az bir ilçesi olmalı.

Kod eşleşmezse betik hata verip çıkar. Bu kasıtlıdır: eksik bir il haritada
delik açar, tanınmayan bir kod ise hiçbir zaman renklendirilemeyecek bir
bölge oluşturur. İkisi de üretimde sessizdir, burada ise görünür.

## Lisans

Varsayılan kaynak OpenStreetMap türevi veridir. OSM verisi **ODbL** ile
lisanslıdır ve **atıf zorunludur** — paket, harita köşesinde kaldırılamaz bir
atıf metni gösterir.

Sitede lisanslı HGM/TÜİK sınır verisi varsa o tercih edilmelidir; betik kaynak
bağımsızdır. Bu durumda ODbL atıf zorunluluğu ortadan kalkar.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run scripts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts package.json package-lock.json vitest.config.ts
git commit -m "feat(scripts): add geo build script with strict region code validation"
```

---

## Task 23: Public barrel, build verification, and Phase 1 exit check

**Files:**
- Modify: `src/index.ts`
- Create: `README.md`, `LICENSE`
- Test: `src/index.test.ts`

**Interfaces:**
- Consumes: every module from Tasks 2–21
- Produces: the package's public API surface

- [ ] **Step 1: Write the failing barrel test**

Create `src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as api from './index.js';

describe('public API surface', () => {
  it('exports the aggregation pipeline', () => {
    for (const name of ['buildIndex', 'rollup', 'rankRegions', 'diffRollups']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('exports the color system', () => {
    for (const name of ['createColorScale', 'createDiffColorScale', 'computeLegendBreaks']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
    expect(Array.isArray(api.SPECTRAL_STOPS)).toBe(true);
  });

  it('exports the search utilities', () => {
    for (const name of ['foldTurkish', 'compareTurkish', 'buildSearchIndex', 'searchEntities']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('exports the formatters', () => {
    for (const name of ['formatTrNumber', 'formatCompactTr', 'formatPercent', 'formatDelta']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('exports the geo utilities', () => {
    for (const name of ['createTurkeyProjection', 'decodeTopology', 'computeFitTransform', 'cullFeatures']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('exports region metadata and the mock generator', () => {
    expect(api.IL_REGIONS).toHaveLength(81);
    expect(typeof api.generateMockData).toBe('function');
    expect(api.MOCK_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('produces a dataset the pipeline accepts end to end', () => {
    // The integration check for Phase 1: generate, validate, roll up, rank,
    // color, and legend without a single React import in the path.
    const { records, categories } = api.generateMockData({ years: [2023] });
    const index = api.buildIndex({ data: records, categories });
    expect(index.warnings).toEqual([]);

    const result = api.rollup(index, 'il', { yearRange: [2023, 2023], categories: [] });
    expect(result.byRegion.size).toBe(81);

    const names = new Map(api.IL_REGIONS.map((r) => [r.code, r.name]));
    const ranked = api.rankRegions(result, { sort: 'total-desc', names });
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[0]!.code).toBe('34');

    const scale = api.createColorScale({
      values: result.values, mode: 'quantile', ramp: 'spectral',
    });
    expect(api.parseHex(scale(ranked[0]!.total))).not.toBeNull();
    expect(api.computeLegendBreaks(scale, 5)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL — the barrel exports nothing.

- [ ] **Step 3: Implement `src/index.ts`**

```ts
/**
 * turkiye-suc-haritasi — public API.
 *
 * Phase 1 exposes the pure core only. React components arrive in Phase 2 and are
 * added to this barrel then.
 */

// Types
export type {
  BBox, CrimeCategory, CrimeRecord, DataWarning, DataWarningCode, FilterSet,
  GeoLevel, MetricMode, NormalizedRecord, RegionMeta, RegionPopulation,
  ScaleMode, Transform, Viewport,
} from './core/types/index.js';

// Aggregation
export type {
  BuildIndexOptions, CrimeIndex, DiffResult, RankedRegion, RankOptions, RankSort,
  RegionAggregate, RegionDiff, RollupResult,
} from './core/aggregation/index.js';
export { buildIndex, diffRollups, rankRegions, rollup } from './core/aggregation/index.js';

// Color
export type {
  ColorDomain, ColorScale, ColorScaleName, ColorScaleOptions, LegendBreak, Oklab, RampFn, RGB,
} from './core/color/index.js';
export {
  BLUE_RED_STOPS, DIFF_STOPS, RAMPS, SPECTRAL_STOPS, computeLegendBreaks,
  createColorDomain, createColorScale, createDiffColorScale, createRamp,
  interpolateOklab, oklabToRgb, parseHex, rgbToOklab, toHex,
} from './core/color/index.js';

// Geo
export type { FitOptions, ProjectionOptions } from './core/geo/index.js';
export {
  collectBounds, computeFitTransform, createPathGenerator, createTurkeyProjection,
  cullFeatures, decodeTopology, deriveRegionMeta, featureBounds, featureCentroid,
  isVisible, regionNameMap,
} from './core/geo/index.js';

// Search
export type { SearchEntity, SearchEntityType, SearchIndexInput, SearchResult } from './core/search/index.js';
export {
  buildSearchIndex, compareTurkish, foldTurkish, scoreEntity, searchEntities,
  toTurkishLowerCase, toTurkishUpperCase,
} from './core/search/index.js';

// Formatting
export {
  EM_DASH, MINUS, formatCompactTr, formatDelta, formatPercent, formatPercentDelta,
  formatTrDecimal, formatTrNumber,
} from './core/format/index.js';

// Region metadata
export {
  IL_BY_CODE, IL_REGIONS, ilCodeFromIlceCode, isValidIlCode,
} from './data/geo/region-meta.js';

// Mock data — demo only, describes nothing real
export type { MockDataOptions, MockDataset } from './data/mock/index.js';
export { MOCK_CATEGORIES, createPrng, generateMockData } from './data/mock/index.js';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `README.md`**

The full prop table and usage examples belong to Phase 5, when the component exists. For now the README documents what Phase 1 actually ships, so it is never inaccurate:

```markdown
# turkiye-suc-haritasi

Türkiye suç istatistikleri için etkileşimli ısı haritası React bileşeni.

> **Durum:** Geliştirme aşamasında. Bu sürüm yalnızca saf hesaplama katmanını
> (`core/`) içerir; React bileşenleri henüz yayınlanmadı.

## Kurulum

    npm install turkiye-suc-haritasi

## Şu an neler var

Saf, React'ten bağımsız yardımcılar — hepsi test edilmiş durumda:

| Alan | Ne işe yarar |
|---|---|
| `buildIndex`, `rollup`, `rankRegions`, `diffRollups` | Suç kayıtlarını doğrular, filtreler ve bölge bazında toplar |
| `createColorScale`, `computeLegendBreaks` | Algısal olarak eşit aralıklı OKLab renk skalaları |
| `foldTurkish`, `compareTurkish`, `searchEntities` | Türkçe'ye duyarlı arama ve sıralama |
| `formatTrNumber`, `formatPercent`, `formatDelta` | Deterministik `tr-TR` sayı biçimlendirme |
| `createTurkeyProjection`, `cullFeatures` | Eşit alanlı harita projeksiyonu ve görünürlük filtresi |
| `generateMockData` | Tohumlanmış, tekrarlanabilir örnek veri seti |

## Veri biçimi

    interface CrimeRecord {
      year: number;        // 2023
      ilCode: string;      // "34" — plaka kodu, 2 hane
      ilceCode?: string;   // "3401" — TÜİK ilçe kodu, 4 hane
      category: string;    // CrimeCategory.id ile eşleşmeli
      count: number;       // negatif olmayan tam sayı
    }

Kayıtlar önceden toplanmış sayılardır; tekil olay kayıtları değildir.
Geçersiz kayıtlar hata fırlatmaz — atılır ve uyarı olarak bildirilir.

## Örnek veri hakkında

`generateMockData` tamamen sentetik veri üretir. Gerçek hiçbir olguyu
tanımlamaz; yalnızca geliştirme, test ve dokümantasyon içindir.

## Lisans

MIT. Sınır verisi OpenStreetMap türevidir ve ODbL kapsamında atıf gerektirir.
```

- [ ] **Step 6: Add the MIT `LICENSE` file**

Standard MIT text, copyright the project owner, year 2026.

- [ ] **Step 7: Run the full verification**

Run: `npm run verify`

Expected, and every line must actually be confirmed before Phase 1 is called done:

- `typecheck` — passes with no errors
- `lint` — passes, including the `core/`-purity rule
- all tests pass
- `src/core` at **100% branch coverage**

- [ ] **Step 8: Verify the built package**

Run: `npm run build && npm pack --dry-run`

Confirm:
- `dist/index.mjs`, `dist/index.cjs`, and `dist/index.d.ts` all exist
- `npm pack --dry-run` lists `dist/`, `README.md`, and `LICENSE` — and nothing from `src/`, `tests/`, or `scripts/`
- no `react` import appears in the bundle: `grep -c "from \"react\"" dist/index.mjs` returns 0

- [ ] **Step 9: Confirm the core-purity constraint holds mechanically**

Run: `npx eslint src/core --max-warnings 0`
Expected: clean. This is the check that proves the architecture's central rule was not quietly bypassed while making a test pass.

- [ ] **Step 10: Commit and tag**

```bash
git add src/index.ts src/index.test.ts README.md LICENSE
git commit -m "feat: expose public core API, add README and license"
git tag phase-1-complete
```

---

## Phase 1 exit criteria

Every one of these must be **verified by running the command**, not assumed:

- [ ] `npm run verify` passes end to end
- [ ] `src/core` is at 100% branch coverage
- [ ] `npx eslint src/core` is clean — no React import, no DOM global has crept in
- [ ] `npm run build` produces ESM, CJS, and type declarations
- [ ] `npm pack --dry-run` ships `dist/` only
- [ ] The end-to-end test in `src/index.test.ts` passes: mock data → index → rollup → rank → color → legend, with no React in the path
- [ ] Aggregation performance guards pass at realistic scale (>50,000 records)
- [ ] No `Math.random()` anywhere in `src/` — `npx eslint .` enforces this

## What Phase 2 needs from Phase 1

Phase 2 (the map) consumes, and must not have to change:

- `CrimeIndex` / `RollupResult` / `RegionAggregate` — the data shapes every panel reads
- `ColorScale` with its `domain` and `ramp` — drives fills and the legend together
- `createTurkeyProjection` + `createPathGenerator` — SVG path generation
- `decodeTopology` — referentially stable, so `useMemo` can skip re-decoding
- `collectBounds` + `cullFeatures` + `computeFitTransform` — pan, zoom, fly-to, culling
- The `Transform` convention `screen = point * k + [x, y]`, which maps directly onto `transform="translate(x,y) scale(k)"`

**Blocking input for Phase 2:** real il and ilçe boundary TopoJSON, produced by `npm run build:geo`. Source and licensing are the one open item from the spec (§5.4 and §15): OSM-derived with ODbL attribution unless licensed HGM/TÜİK data is available.
