import { describe, expect, it } from 'vitest';
import { collapseSlices, type Slice } from './collapse.js';

const OPTS = { minShare: 0.03, maxSlices: 6, otherLabel: 'Diğer' };

const EIGHT: Slice[] = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i}`, label: `Kategori ${i}`, value: 100 - i,
}));

describe('collapseSlices', () => {
  it('leaves a small, well-spread set alone', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 60 }, { id: 'b', label: 'B', value: 40 }],
      OPTS,
    );
    expect(out).toHaveLength(2);
    expect(out.every((s) => !s.isOther)).toBe(true);
  });

  it('computes each share against the total', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 75 }, { id: 'b', label: 'B', value: 25 }],
      OPTS,
    );
    expect(out[0]?.share).toBeCloseTo(0.75);
    expect(out[1]?.share).toBeCloseTo(0.25);
  });

  it('orders slices largest first', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 10 }, { id: 'b', label: 'B', value: 90 }],
      OPTS,
    );
    expect(out[0]?.id).toBe('b');
  });

  it('folds anything under the minimum share into Diğer', () => {
    const out = collapseSlices([
      { id: 'a', label: 'A', value: 970 },
      { id: 'b', label: 'B', value: 20 },
      { id: 'c', label: 'C', value: 10 },
    ], OPTS);
    expect(out).toHaveLength(2);
    expect(out[1]?.isOther).toBe(true);
    expect(out[1]?.value).toBe(30);
    expect(out[1]?.members).toEqual(['b', 'c']);
  });

  /**
   * Eight near-equal categories clear the 3% floor individually, so without a
   * cap every one of them renders and the chart becomes unreadable.
   */
  it('caps the visible slices even when every share clears the floor', () => {
    const out = collapseSlices(EIGHT, OPTS);
    expect(out).toHaveLength(6);
    expect(out[5]?.isOther).toBe(true);
    expect(out[5]?.members).toHaveLength(3);
  });

  it('keeps the total intact when it folds', () => {
    const out = collapseSlices(EIGHT, OPTS);
    expect(out.reduce((sum, s) => sum + s.value, 0))
      .toBe(EIGHT.reduce((sum, s) => sum + s.value, 0));
  });

  it('shares still sum to one after folding', () => {
    expect(collapseSlices(EIGHT, OPTS).reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it('does not create a Diğer slice holding a single member', () => {
    // Folding one slice into "Other" hides its name for no gain.
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 990 }, { id: 'b', label: 'B', value: 10 }],
      OPTS,
    );
    expect(out.some((s) => s.isOther)).toBe(false);
    expect(out[1]?.label).toBe('B');
  });

  it('lifts both limits when asked, revealing everything', () => {
    const out = collapseSlices(EIGHT, {
      minShare: 0, maxSlices: Number.POSITIVE_INFINITY, otherLabel: 'Diğer',
    });
    expect(out).toHaveLength(8);
    expect(out.some((s) => s.isOther)).toBe(false);
  });

  it('returns nothing for an empty input', () => {
    expect(collapseSlices([], OPTS)).toEqual([]);
  });

  it('returns nothing when every value is zero, rather than dividing by zero', () => {
    expect(collapseSlices(
      [{ id: 'a', label: 'A', value: 0 }, { id: 'b', label: 'B', value: 0 }],
      OPTS,
    )).toEqual([]);
  });

  it('drops zero-valued slices, which would render as invisible arcs', () => {
    const out = collapseSlices(
      [{ id: 'a', label: 'A', value: 100 }, { id: 'b', label: 'B', value: 0 }],
      OPTS,
    );
    expect(out).toHaveLength(1);
  });
});
