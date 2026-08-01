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
    expect(isVisible(bbox(0, 0, 10, 10), IDENTITY, { width: 100, height: 0 }, 0)).toBe(false);
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

  it('honors an explicit margin', () => {
    const nearby = new Map<string, BBox>([['x', bbox(1020, 100, 1080, 200)]]);
    expect(cullFeatures(nearby, IDENTITY, VIEWPORT, 0).has('x')).toBe(false);
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
