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
