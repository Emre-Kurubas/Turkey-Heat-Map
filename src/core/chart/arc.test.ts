import { describe, expect, it } from 'vitest';
import { arcPath } from './arc.js';

const BASE = { cx: 100, cy: 100, innerRadius: 40, outerRadius: 70 };

/**
 * Every drawn coordinate in a path.
 *
 * Only M/L targets and arc endpoints count. A naive "every x,y pair" match also
 * picks up the `rx,ry` radii inside an `A` command, which are not points at all
 * and sit at the wrong distance from the centre.
 */
function points(d: string): [number, number][] {
  const moves = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)];
  const arcs = [...d.matchAll(/A[\d.]+,[\d.]+ \d+ \d+ \d+ (-?[\d.]+),(-?[\d.]+)/gu)];
  return [...moves, ...arcs].map((m) => [Number(m[1]), Number(m[2])]);
}

describe('arcPath', () => {
  it('produces a closed donut segment', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI / 2 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
    expect(d).toContain('A');
  });

  it('keeps every point between the inner and outer radius', () => {
    const d = arcPath({ ...BASE, startAngle: 0.3, endAngle: 2.1 });
    for (const [x, y] of points(d)) {
      const r = Math.hypot(x - BASE.cx, y - BASE.cy);
      expect(r).toBeLessThanOrEqual(BASE.outerRadius + 0.001);
      expect(r).toBeGreaterThanOrEqual(BASE.innerRadius - 0.001);
    }
  });

  it('starts at twelve o clock, so the first slice reads from the top', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: 0.5 });
    const [first] = points(d);
    expect(first![0]).toBeCloseTo(BASE.cx, 3);
    expect(first![1]).toBeCloseTo(BASE.cy - BASE.outerRadius, 3);
  });

  it('sets the large-arc flag past a half turn', () => {
    const small = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI / 2 });
    const large = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI * 1.5 });
    expect(small).toContain(' 0 1 ');
    expect(large).toContain(' 1 1 ');
  });

  it('returns an empty path for a zero-width slice rather than a stray line', () => {
    expect(arcPath({ ...BASE, startAngle: 1, endAngle: 1 })).toBe('');
  });

  it('returns an empty path for a negative sweep', () => {
    expect(arcPath({ ...BASE, startAngle: 2, endAngle: 1 })).toBe('');
  });

  it('draws a full ring without collapsing to nothing', () => {
    const d = arcPath({ ...BASE, startAngle: 0, endAngle: Math.PI * 2 });
    expect(d).not.toBe('');
    expect(points(d).length).toBeGreaterThan(2);
  });

  it('supports a zero inner radius, giving a solid pie wedge', () => {
    const d = arcPath({ ...BASE, innerRadius: 0, startAngle: 0, endAngle: 1 });
    const hasCentre = points(d).some(
      ([x, y]) => Math.abs(x - BASE.cx) < 0.001 && Math.abs(y - BASE.cy) < 0.001,
    );
    expect(hasCentre).toBe(true);
  });
});
