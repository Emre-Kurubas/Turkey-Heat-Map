import { describe, expect, it } from 'vitest';
import { computeWindow } from './window.js';

const BASE = { scrollTop: 0, viewportHeight: 300, rowHeight: 30, count: 100 };

describe('computeWindow', () => {
  it('starts at the top with no overscan', () => {
    const w = computeWindow({ ...BASE, overscan: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(10);
    expect(w.offsetY).toBe(0);
  });

  it('reports the full scroll height so the scrollbar is honest', () => {
    expect(computeWindow(BASE).totalHeight).toBe(3000);
  });

  it('moves the window as the list scrolls', () => {
    const w = computeWindow({ ...BASE, scrollTop: 300, overscan: 0 });
    expect(w.startIndex).toBe(10);
    expect(w.offsetY).toBe(300);
  });

  it('aligns the offset to a row boundary, so rows do not jitter mid-scroll', () => {
    const w = computeWindow({ ...BASE, scrollTop: 305, overscan: 0 });
    expect(w.startIndex).toBe(10);
    expect(w.offsetY).toBe(300);
  });

  it('pads by the overscan on both sides', () => {
    // 300/30 puts row 10 at the top and 10 rows fit, so the padded window runs
    // from 7 to 10 + 10 + 3.
    const w = computeWindow({ ...BASE, scrollTop: 300, overscan: 3 });
    expect(w.startIndex).toBe(7);
    expect(w.endIndex).toBe(23);
  });

  it('never starts before the first row', () => {
    expect(computeWindow({ ...BASE, scrollTop: 0, overscan: 5 }).startIndex).toBe(0);
  });

  it('treats a negative scroll position as the top', () => {
    expect(computeWindow({ ...BASE, scrollTop: -200, overscan: 0 }).startIndex).toBe(0);
  });

  it('never ends past the last row', () => {
    const w = computeWindow({ ...BASE, scrollTop: 100_000, overscan: 5 });
    expect(w.endIndex).toBe(100);
    expect(w.startIndex).toBeLessThanOrEqual(w.endIndex);
  });

  it('handles an empty list', () => {
    const w = computeWindow({ ...BASE, count: 0 });
    expect(w).toEqual({ startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 });
  });

  it('handles a list shorter than the viewport', () => {
    const w = computeWindow({ ...BASE, count: 3, overscan: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(3);
    expect(w.totalHeight).toBe(90);
  });

  it('treats an unmeasured viewport as showing nothing rather than everything', () => {
    const w = computeWindow({ ...BASE, viewportHeight: 0, overscan: 0 });
    expect(w.endIndex).toBe(0);
  });

  it('treats a negative viewport height as unmeasured', () => {
    expect(computeWindow({ ...BASE, viewportHeight: -50, overscan: 0 }).endIndex).toBe(0);
  });

  it('refuses a non-positive row height instead of dividing by zero', () => {
    expect(computeWindow({ ...BASE, rowHeight: 0 })).toEqual(
      { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 },
    );
  });

  it('defaults to a non-zero overscan, so scrolling does not reveal blank rows', () => {
    const w = computeWindow({ ...BASE, scrollTop: 300 });
    expect(w.startIndex).toBeLessThan(10);
  });
});
