import type { Viewport } from '@/core/types/index.js';

export interface TooltipPlacement {
  x: number;
  y: number;
  flippedX: boolean;
  flippedY: boolean;
}

const DEFAULT_OFFSET = 12;

/**
 * Positions the tooltip near the cursor without letting it leave the viewport.
 *
 * Flipping to the other side of the cursor is preferred over merely clamping,
 * because a clamped tooltip sits *under* the pointer and hides the region being
 * described. The final clamp to zero is a last resort for the case where the
 * tooltip is larger than the viewport itself.
 */
export function placeTooltip(
  point: readonly [number, number],
  size: { width: number; height: number },
  viewport: Viewport,
  offset: number = DEFAULT_OFFSET,
): TooltipPlacement {
  const [px, py] = point;

  const flippedX = px + offset + size.width > viewport.width;
  const flippedY = py + offset + size.height > viewport.height;

  const x = flippedX ? px - offset - size.width : px + offset;
  const y = flippedY ? py - offset - size.height : py + offset;

  return { x: Math.max(0, x), y: Math.max(0, y), flippedX, flippedY };
}
