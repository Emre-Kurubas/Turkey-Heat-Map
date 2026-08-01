import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPlacement.js';

const VIEWPORT = { width: 1000, height: 600 };
const SIZE = { width: 200, height: 120 };

describe('placeTooltip', () => {
  it('sits below and right of the cursor by the offset', () => {
    expect(placeTooltip([100, 100], SIZE, VIEWPORT, 12)).toMatchObject({ x: 112, y: 112 });
  });

  it('flips horizontally when it would overflow the right edge', () => {
    const placed = placeTooltip([950, 100], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(true);
    expect(placed.x).toBe(950 - 12 - SIZE.width);
  });

  it('flips vertically when it would overflow the bottom edge', () => {
    const placed = placeTooltip([100, 560], SIZE, VIEWPORT, 12);
    expect(placed.flippedY).toBe(true);
    expect(placed.y).toBe(560 - 12 - SIZE.height);
  });

  it('flips both axes in the bottom-right corner', () => {
    const placed = placeTooltip([980, 590], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(true);
    expect(placed.flippedY).toBe(true);
  });

  it('never places the tooltip off the left or top edge, even when flipping would', () => {
    const placed = placeTooltip(
      [5, 5], { width: 400, height: 300 }, { width: 300, height: 200 }, 12,
    );
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.y).toBeGreaterThanOrEqual(0);
  });

  it('does not flip when it fits', () => {
    const placed = placeTooltip([400, 300], SIZE, VIEWPORT, 12);
    expect(placed.flippedX).toBe(false);
    expect(placed.flippedY).toBe(false);
  });

  it('uses a 12px offset by default, per the spec', () => {
    expect(placeTooltip([100, 100], SIZE, VIEWPORT)).toMatchObject({ x: 112, y: 112 });
  });

  it('handles an unmeasured tooltip without producing NaN', () => {
    const placed = placeTooltip([100, 100], { width: 0, height: 0 }, VIEWPORT);
    expect(Number.isFinite(placed.x)).toBe(true);
    expect(Number.isFinite(placed.y)).toBe(true);
  });
});
