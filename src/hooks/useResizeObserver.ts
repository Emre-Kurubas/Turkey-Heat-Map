import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import type { Viewport } from '@/core/types/index.js';

const UNMEASURED: Viewport = { width: 0, height: 0 };

/**
 * Measures an element.
 *
 * Returns `{ width: 0, height: 0 }` until the first observation. That is a real
 * state, not a placeholder: `createTurkeyProjection` treats a zero-sized
 * viewport as "not laid out yet" and returns an unfitted projection, so callers
 * can render nothing and re-create once a real size arrives.
 *
 * Sizes are rounded, because a sub-pixel resize would otherwise rebuild the
 * projection and re-run the blur filter for no visible benefit.
 */
export function useResizeObserver<T extends Element>(): [
  // MutableRefObject, not RefObject: a read-only RefObject<T | null> is not
  // assignable to React's `ref` prop, which expects to be able to write to it.
  MutableRefObject<T | null>,
  Viewport,
] {
  const ref = useRef<T | null>(null);
  const [viewport, setViewport] = useState<Viewport>(UNMEASURED);

  useEffect(() => {
    if (typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect === undefined) return;

      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setViewport((prev) => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    });

    const node = ref.current;
    if (node !== null) observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  return [ref, viewport];
}
