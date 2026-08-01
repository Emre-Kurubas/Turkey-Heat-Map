import { describe, expect, it } from 'vitest';
import type { Transform, Viewport } from '@/core/types/index.js';
import { MAX_ZOOM, MIN_ZOOM, clampTransform, deriveLevel, panBy, zoomAt } from './zoom.js';

const VIEWPORT: Viewport = { width: 1000, height: 600 };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

describe('clampTransform', () => {
  it('holds the scale within bounds', () => {
    expect(clampTransform({ k: 0.2, x: 0, y: 0 }, VIEWPORT).k).toBe(MIN_ZOOM);
    expect(clampTransform({ k: 99, x: 0, y: 0 }, VIEWPORT).k).toBe(MAX_ZOOM);
  });

  it('pins the content at identity so the map cannot be dragged off-screen', () => {
    expect(clampTransform({ k: 1, x: 500, y: 400 }, VIEWPORT)).toEqual(IDENTITY);
  });

  it('allows panning proportional to the zoom level', () => {
    // At k=3 the content is 3x the viewport, so 2 viewports of travel exist.
    const limit = VIEWPORT.width * (3 - 1);
    expect(clampTransform({ k: 3, x: -1200, y: 0 }, VIEWPORT).x).toBe(-1200);
    expect(clampTransform({ k: 3, x: -limit, y: 0 }, VIEWPORT).x).toBe(-limit);
  });

  it('clamps panning that would pull the content past its far edge', () => {
    const limit = VIEWPORT.width * (3 - 1);
    expect(clampTransform({ k: 3, x: -9999, y: 0 }, VIEWPORT).x).toBe(-limit);
  });

  it('clamps the vertical axis the same way', () => {
    expect(clampTransform({ k: 3, x: 0, y: -9999 }, VIEWPORT).y)
      .toBe(-(VIEWPORT.height * (3 - 1)));
  });

  it('never allows positive overscroll past the left or top edge', () => {
    const panned = clampTransform({ k: 3, x: 200, y: 200 }, VIEWPORT);
    expect(panned.x).toBe(0);
    expect(panned.y).toBe(0);
  });

  it('treats a zero-sized viewport as unmeasured and returns identity', () => {
    expect(clampTransform({ k: 5, x: 10, y: 10 }, { width: 0, height: 0 })).toEqual(IDENTITY);
    expect(clampTransform({ k: 5, x: 10, y: 10 }, { width: 100, height: 0 })).toEqual(IDENTITY);
  });
});

describe('zoomAt', () => {
  it('keeps the anchor point stationary', () => {
    const anchor: [number, number] = [400, 300];
    const zoomed = zoomAt(IDENTITY, 2, anchor, VIEWPORT);
    // World point under the cursor before and after must match.
    const before = (anchor[0] - IDENTITY.x) / IDENTITY.k;
    const after = (anchor[0] - zoomed.x) / zoomed.k;
    expect(after).toBeCloseTo(before, 6);
  });

  it('scales by the factor', () => {
    expect(zoomAt(IDENTITY, 2, [500, 300], VIEWPORT).k).toBe(2);
  });

  it('refuses to zoom below the minimum', () => {
    expect(zoomAt(IDENTITY, 0.1, [500, 300], VIEWPORT).k).toBe(MIN_ZOOM);
  });

  it('refuses to zoom above the maximum', () => {
    expect(zoomAt({ k: MAX_ZOOM, x: 0, y: 0 }, 4, [500, 300], VIEWPORT).k).toBe(MAX_ZOOM);
  });

  it('is a no-op on an unmeasured viewport', () => {
    expect(zoomAt(IDENTITY, 2, [0, 0], { width: 0, height: 0 })).toEqual(IDENTITY);
  });
});

describe('panBy', () => {
  it('moves the transform', () => {
    const panned = panBy({ k: 3, x: -100, y: -100 }, -50, -25, VIEWPORT);
    expect(panned.x).toBe(-150);
    expect(panned.y).toBe(-125);
  });

  it('clamps at the edge', () => {
    expect(panBy({ k: 2, x: 0, y: 0 }, 100, 0, VIEWPORT).x).toBe(0);
  });
});

describe('deriveLevel', () => {
  const T = 2.5;
  const H = 0.15;

  it('shows provinces well below the threshold', () => {
    expect(deriveLevel(1, 'il', T, H)).toBe('il');
  });

  it('shows districts well above the threshold', () => {
    expect(deriveLevel(6, 'il', T, H)).toBe('ilce');
  });

  it('only switches up once past threshold + hysteresis', () => {
    expect(deriveLevel(T + H - 0.01, 'il', T, H)).toBe('il');
    expect(deriveLevel(T + H + 0.01, 'il', T, H)).toBe('ilce');
  });

  it('only switches down once past threshold - hysteresis', () => {
    expect(deriveLevel(T - H + 0.01, 'ilce', T, H)).toBe('ilce');
    expect(deriveLevel(T - H - 0.01, 'ilce', T, H)).toBe('il');
  });

  it('holds the current level throughout the dead band, in both directions', () => {
    for (const k of [T - H, T, T + H]) {
      expect(deriveLevel(k, 'il', T, H)).toBe('il');
      expect(deriveLevel(k, 'ilce', T, H)).toBe('ilce');
    }
  });
});
