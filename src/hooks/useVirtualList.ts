import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { computeWindow, type ListWindow } from '@/core/list/index.js';

export interface VirtualList {
  ref: MutableRefObject<HTMLDivElement | null>;
  window: ListWindow;
  onScroll: () => void;
}

/**
 * Tracks scroll position and viewport height for a uniform-height list.
 *
 * Scroll position is state, not a ref, because the rendered slice depends on
 * it. Each update re-renders only the rows inside the window — not the 900-odd
 * outside it, which is the whole point.
 */
export function useVirtualList(rowHeight: number, count: number): VirtualList {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onScroll = useCallback(() => {
    const node = ref.current;
    if (node !== null) setScrollTop(node.scrollTop);
  }, []);

  // The list has no size on the first render, so the window would stay empty
  // forever without measuring after mount.
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    setViewportHeight(node.clientHeight);
    if (typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(() => { setViewportHeight(node.clientHeight); });
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  return {
    ref,
    onScroll,
    window: computeWindow({ scrollTop, viewportHeight, rowHeight, count }),
  };
}
