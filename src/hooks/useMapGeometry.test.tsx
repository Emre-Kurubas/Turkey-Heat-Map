import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GeoLevel, Transform } from '@/core/types/index.js';
import { useMapGeometry } from './useMapGeometry.js';

const VIEWPORT = { width: 1000, height: 600 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

describe('useMapGeometry', () => {
  it('is not ready before the container has been measured', () => {
    const { result } = renderHook(
      () => useMapGeometry({ width: 0, height: 0 }, 'il', IDENTITY),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.features).toHaveLength(0);
  });

  it('projects all 81 provinces to non-empty path data', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.features).toHaveLength(81);
    for (const feature of result.current.features) {
      expect(feature.d.startsWith('M')).toBe(true);
    }
  });

  it('carries the Turkish region name with each path', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.features.find((f) => f.code === '34')?.name).toBe('İstanbul');
  });

  it('projects all 973 districts at ilçe level', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', IDENTITY));
    expect(result.current.features).toHaveLength(973);
  });

  it('considers every province visible at identity', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    expect(result.current.visible.size).toBe(81);
  });

  it('culls districts outside the viewport when zoomed in', () => {
    const zoomed: Transform = { k: 8, x: -2000, y: -1200 };
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'ilce', zoomed));
    expect(result.current.visible.size).toBeLessThan(973);
    expect(result.current.visible.size).toBeGreaterThan(0);
  });

  it('reuses projected paths when only the transform changes', () => {
    const { result, rerender } = renderHook(
      ({ transform }: { transform: Transform }) => useMapGeometry(VIEWPORT, 'il', transform),
      { initialProps: { transform: IDENTITY } },
    );
    const before = result.current.features;

    rerender({ transform: { k: 3, x: -100, y: -50 } });
    // Panning must not re-project: the paths are drawn once and moved by the
    // group transform. Re-projecting here would re-run the blur on every drag.
    expect(result.current.features).toBe(before);
  });

  it('re-projects when the level changes', () => {
    const { result, rerender } = renderHook(
      ({ level }: { level: GeoLevel }) => useMapGeometry(VIEWPORT, level, IDENTITY),
      { initialProps: { level: 'il' as GeoLevel } },
    );
    const before = result.current.features;

    rerender({ level: 'ilce' as GeoLevel });
    expect(result.current.features).not.toBe(before);
  });

  it('keeps every projected path inside the viewport box at identity', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
    for (const [, bbox] of result.current.bounds) {
      const [[minX, minY], [maxX, maxY]] = bbox;
      expect(minX).toBeGreaterThanOrEqual(-1);
      expect(minY).toBeGreaterThanOrEqual(-1);
      expect(maxX).toBeLessThanOrEqual(VIEWPORT.width + 1);
      expect(maxY).toBeLessThanOrEqual(VIEWPORT.height + 1);
    }
  });

  it('fills a good share of the viewport, proving the projection actually fitted', () => {
    const { result } = renderHook(() => useMapGeometry(VIEWPORT, 'il', IDENTITY));
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
