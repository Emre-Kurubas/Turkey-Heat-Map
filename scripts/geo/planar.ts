/**
 * Planar polygon geometry for the source-preparation step.
 *
 * Deliberately planar, not spherical. `d3-geo` treats rings as spherical and
 * therefore depends on winding order: a clockwise exterior ring is read as the
 * complement of its own area, so a single mis-wound province appears to contain
 * the entire globe. Source boundary files do not guarantee winding, and at
 * Türkiye's extent — roughly 26°–45°E, 36°–42°N, far from a pole or the
 * antimeridian — planar containment is exact for this purpose.
 *
 * These helpers run offline during data preparation. They are not shipped.
 */

/** A `[longitude, latitude]` pair. */
export type Position = readonly [number, number];
/** A closed linear ring. */
export type Ring = readonly Position[];
/** An outer ring followed by any hole rings. */
export type PolygonRings = readonly Ring[];

/** Every polygon of a feature, normalizing `Polygon` and `MultiPolygon`. */
export function polygonsOf(feature: GeoJSON.Feature): PolygonRings[] {
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') return [geometry.coordinates as unknown as PolygonRings];
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as unknown as PolygonRings[];
  }
  throw new Error(`[planar] Beklenmeyen geometri türü: ${geometry.type}`);
}

/** Signed shoelace area. The sign encodes winding, so callers take `Math.abs`. */
export function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

/** Ray-casting containment. Points exactly on an edge are not guaranteed. */
export function pointInRing(point: Position, ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside an outer ring and outside all of that polygon's holes. */
export function pointInPolygons(point: Position, polygons: readonly PolygonRings[]): boolean {
  for (const rings of polygons) {
    const outer = rings[0];
    if (outer === undefined || !pointInRing(point, outer)) continue;

    let inHole = false;
    for (let h = 1; h < rings.length; h += 1) {
      if (pointInRing(point, rings[h]!)) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

/** Bounding box `[minX, minY, maxX, maxY]` over the outer rings. */
export function bboxOf(polygons: readonly PolygonRings[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of polygons) {
    for (const [x, y] of rings[0] ?? []) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

/** Area-weighted centroid. Falls back to the first vertex on a degenerate ring. */
export function centroidOfRing(ring: Ring): Position {
  let cx = 0, cy = 0, area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  area *= 0.5;
  if (area === 0) return ring[0] ?? [0, 0];
  return [cx / (6 * area), cy / (6 * area)];
}

/**
 * Rewinds rings to d3-geo's winding: exterior **clockwise** in lon/lat,
 * holes counter-clockwise.
 *
 * Note this is the opposite of RFC 7946, which specifies counter-clockwise
 * exteriors. d3-geo predates that RFC and never adopted it, and d3-geo is what
 * renders this data — so d3's convention is the one that matters here. Verified
 * directly: a 1° square around Ankara measures 2.35e-4 steradians wound
 * clockwise, and 12.566 — the entire sphere — wound counter-clockwise.
 *
 * Getting this backwards is silent and catastrophic rather than noisy. d3 reads
 * a wrongly-wound exterior ring as the *complement* of its area, so `geoBounds`
 * returns the whole world, `fitExtent` shrinks Türkiye to a few pixels, and
 * `geoContains` matches every point on Earth. Published boundary files disagree
 * about winding, so normalize instead of trusting the source.
 */
export function rewindGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return geometry;

  const rewindPolygon = (rings: GeoJSON.Position[][]): GeoJSON.Position[][] =>
    rings.map((ring, index) => {
      const area = ringArea(ring as unknown as Ring);
      // Exterior ring (index 0) wants negative (clockwise) area; holes positive.
      const wantNegative = index === 0;
      return (area < 0) === wantNegative ? ring : [...ring].reverse();
    });

  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: rewindPolygon(geometry.coordinates) };
  }
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(rewindPolygon) };
}

/** The polygon with the largest absolute outer-ring area. */
export function largestPolygon(polygons: readonly PolygonRings[]): PolygonRings {
  let best = polygons[0];
  if (best === undefined) throw new Error('[planar] Poligonsuz geometri.');

  let bestArea = Math.abs(ringArea(best[0] ?? []));
  for (const rings of polygons) {
    const area = Math.abs(ringArea(rings[0] ?? []));
    if (area > bestArea) { bestArea = area; best = rings; }
  }
  return best;
}

/**
 * A point that lies inside the feature's largest polygon.
 *
 * The centroid is used when it falls inside. For a concave or ring-shaped
 * district it can fall outside its own polygon — a centroid-only join would
 * then silently attribute that district to a neighbouring province — so a grid
 * scan finds a genuine interior point instead.
 */
export function representativePoint(polygons: readonly PolygonRings[]): Position {
  const big = largestPolygon(polygons);
  const centroid = centroidOfRing(big[0] ?? []);
  if (pointInPolygons(centroid, [big])) return centroid;

  const [minX, minY, maxX, maxY] = bboxOf([big]);
  const steps = 32;
  for (let gy = 1; gy < steps; gy += 1) {
    for (let gx = 1; gx < steps; gx += 1) {
      const candidate: Position = [
        minX + ((maxX - minX) * gx) / steps,
        minY + ((maxY - minY) * gy) / steps,
      ];
      if (pointInPolygons(candidate, [big])) return candidate;
    }
  }
  return centroid;
}
