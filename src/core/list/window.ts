export interface ListWindow {
  /** First row to render, inclusive. */
  startIndex: number;
  /** Last row to render, exclusive. */
  endIndex: number;
  /** Pixel offset of `startIndex` from the top of the scroll content. */
  offsetY: number;
  /** Full height of every row, rendered or not. */
  totalHeight: number;
}

export interface WindowOptions {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  /** Extra rows rendered on each side, hiding the seam during a fast scroll. */
  overscan?: number;
}

const DEFAULT_OVERSCAN = 4;
const NOTHING: ListWindow = { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 };

/**
 * Which slice of a uniform-height list is worth rendering.
 *
 * `offsetY` is aligned to a row boundary rather than tracking `scrollTop`
 * exactly: the rendered slice is positioned by that offset, and a sub-row value
 * would make every row shimmer by a few pixels as you scroll.
 *
 * A zero viewport renders nothing rather than everything — the alternative
 * mounts all 973 rows during the first frame, before layout has run, which is
 * exactly the cost this function exists to avoid.
 */
export function computeWindow(options: WindowOptions): ListWindow {
  const { scrollTop, viewportHeight, rowHeight, count, overscan = DEFAULT_OVERSCAN } = options;
  if (rowHeight <= 0 || count <= 0) return NOTHING;

  const totalHeight = count * rowHeight;
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visibleCount = Math.ceil(Math.max(0, viewportHeight) / rowHeight);

  // Clamped to `count` at both ends. A scroll position past the content — which
  // a caller can pass even though a real scroller cannot reach it — would
  // otherwise produce indices beyond the list and an offset far below it.
  const startIndex = Math.min(count, Math.max(0, firstVisible - overscan));
  const endIndex = Math.min(count, firstVisible + visibleCount + overscan);

  return {
    startIndex,
    endIndex: Math.max(startIndex, endIndex),
    offsetY: startIndex * rowHeight,
    totalHeight,
  };
}
