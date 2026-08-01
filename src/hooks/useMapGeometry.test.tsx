import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GeoLevel, Transform } from '@/core/types/index.js';
import { useMapGeometry } from './useMapGeometry.js';

const VIEWPORT = { width: 1000, height: 600 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

/** Country zoom: provinces outlined, districts painted. */
function countryZoom(transform: Transform = IDENTITY) {
  return renderHook(() => useMapGeometry(VIEWPORT, 'il', 'ilce', transform));
}

describe('useMapGeometry', () => {
  it('is not ready before the container has been measured', () => {
    const { result } = renderHook(
      () => useMapGeometry({ width: 0, height: 0 }, 'il', 'ilce', IDENTITY),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.heat).toHaveLength(0);
    expect(result.current.outline).toHaveLength(0);
  });

  it('paints districts while outlining provinces at country zoom', () => {
    const { result } = countryZoom();
    expect(result.current.heat).toHaveLength(973);
    expect(result.current.outline).toHaveLength(81);
  });

  it('outlines districts once zoomed in, still painting districts', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', 'ilce', IDENTITY));
    expect(result.current.heat).toHaveLength(973);
    expect(result.current.outline).toHaveLength(973);
  });

  it('reuses one projection when both levels are the same', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', 'ilce', IDENTITY));
    // Same array identity means the level was projected once, not twice.
    expect(result.current.outline).toBe(result.current.heat);
  });

  it('falls back to province heat for a dataset with no district codes', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', 'il', IDENTITY));
    expect(result.current.heat).toHaveLength(81);
  });

  it('projects to non-empty path data', () => {
    const { result } = countryZoom();
    for (const feature of [...result.current.heat, ...result.current.outline]) {
      expect(feature.d.startsWith('M')).toBe(true);
    }
  });

  it('carries the Turkish region name with each path', () => {
    const { result } = countryZoom();
    expect(result.current.outline.find((f) => f.code === '34')?.name).toBe('İstanbul');
    expect(result.current.heat.find((f) => f.code === '3401')?.name).toBe('Adalar');
  });

  /**
   * The district heat is drawn under the province borders. If the two levels
   * were fitted independently, any difference in their extents would offset one
   * from the other and read as a rendering bug.
   */
  it('aligns the two levels exactly, since they share one projection', () => {
    const { result } = countryZoom();

    const extent = (features: readonly { d: string }[]) => {
      let minX = Infinity; let maxX = -Infinity;
      for (const { d } of features) {
        for (const match of d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)) {
          const x = Number(match[1]);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      return { minX, maxX };
    };

    const heat = extent(result.current.heat);
    const outline = extent(result.current.outline);
    expect(heat.minX).toBeCloseTo(outline.minX, 0);
    expect(heat.maxX).toBeCloseTo(outline.maxX, 0);
  });

  it('considers everything visible at identity', () => {
    const { result } = countryZoom();
    expect(result.current.visibleOutline.size).toBe(81);
    expect(result.current.visibleHeat.size).toBe(973);
  });

  it('culls both layers independently when zoomed in', () => {
    const { result } = countryZoom({ k: 8, x: -2000, y: -1200 });
    expect(result.current.visibleHeat.size).toBeLessThan(973);
    expect(result.current.visibleHeat.size).toBeGreaterThan(0);
    expect(result.current.visibleOutline.size).toBeLessThan(81);
  });

  it('reuses projected paths when only the transform changes', () => {
    const { result, rerender } = renderHook(
      ({ transform }: { transform: Transform }) =>
        useMapGeometry(VIEWPORT, 'il', 'ilce', transform),
      { initialProps: { transform: IDENTITY } },
    );
    const before = result.current.heat;

    rerender({ transform: { k: 3, x: -100, y: -50 } });
    // Panning must not re-project: the paths are drawn once and moved by the
    // group transform. Re-projecting here would re-run the blur on every drag.
    expect(result.current.heat).toBe(before);
  });

  it('re-projects the outline when the zoom level changes, but not the heat', () => {
    const { result, rerender } = renderHook(
      ({ level }: { level: GeoLevel }) => useMapGeometry(VIEWPORT, level, 'ilce', IDENTITY),
      { initialProps: { level: 'il' as GeoLevel } },
    );
    const beforeOutline = result.current.outline;

    rerender({ level: 'ilce' as GeoLevel });
    expect(result.current.outline).not.toBe(beforeOutline);
    expect(result.current.outline).toHaveLength(973);
  });

  it('exposes outline bounds inside the viewport box at identity', () => {
    const { result } = countryZoom();
    for (const [, bbox] of result.current.bounds) {
      const [[minX, minY], [maxX, maxY]] = bbox;
      expect(minX).toBeGreaterThanOrEqual(-1);
      expect(minY).toBeGreaterThanOrEqual(-1);
      expect(maxX).toBeLessThanOrEqual(VIEWPORT.width + 1);
      expect(maxY).toBeLessThanOrEqual(VIEWPORT.height + 1);
    }
  });

  it('fills a good share of the viewport, proving the projection actually fitted', () => {
    const { result } = countryZoom();
    let minX = Infinity; let maxX = -Infinity;
    for (const [, [[x0], [x1]]] of result.current.bounds) {
      if (x0 < minX) minX = x0;
      if (x1 > maxX) maxX = x1;
    }
    // A winding-order regression collapses the country to a few pixels; this is
    // the cheap guard against that ever coming back.
    expect(maxX - minX).toBeGreaterThan(VIEWPORT.width * 0.8);
  });
});
