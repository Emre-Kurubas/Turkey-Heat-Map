import { describe, expect, it } from 'vitest';
import { CATEGORY_PALETTE, categoryColor } from './palette.js';

describe('CATEGORY_PALETTE', () => {
  it('has eight validated slots', () => {
    expect(CATEGORY_PALETTE).toHaveLength(8);
  });

  it('is all six-digit hex', () => {
    for (const hex of CATEGORY_PALETTE) expect(hex).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('has no duplicate hues', () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
  });
});

describe('categoryColor', () => {
  it('maps an index to its fixed slot', () => {
    expect(categoryColor(0)).toBe(CATEGORY_PALETTE[0]);
    expect(categoryColor(3)).toBe(CATEGORY_PALETTE[3]);
  });

  /**
   * Colour follows the entity, not its rank. A ninth category reusing slot 1
   * would be indistinguishable from the first, so the caller must fold its tail
   * into "other" instead — this clamp makes the failure visible rather than
   * silently generating a duplicate.
   */
  it('clamps past the last slot rather than cycling', () => {
    expect(categoryColor(8)).toBe(CATEGORY_PALETTE[7]);
    expect(categoryColor(99)).toBe(CATEGORY_PALETTE[7]);
  });

  it('clamps a negative index to the first slot', () => {
    expect(categoryColor(-1)).toBe(CATEGORY_PALETTE[0]);
  });
});

function luminance(hex: string): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16))
    + 0.7152 * channel(parseInt(hex.slice(3, 5), 16))
    + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}

describe('CATEGORY_PALETTE on a light panel', () => {
  it('is stepped for a light surface, not a dark one', () => {
    // The dark column sits lighter than these; if this passes with the dark
    // hexes still in place, the swap did not happen.
    expect(CATEGORY_PALETTE).toContain('#2a78d6');
    expect(CATEGORY_PALETTE).not.toContain('#3987e5');
  });

  it('keeps every hue mid-toned, so none reads as ink or as background', () => {
    for (const hex of CATEGORY_PALETTE) {
      expect(luminance(hex), hex).toBeGreaterThan(0.05);
      expect(luminance(hex), hex).toBeLessThan(0.6);
    }
  });
});
