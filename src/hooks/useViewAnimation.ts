import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MAX_ZOOM, computeFitTransform } from '@/core/geo/index.js';
import type { BBox, Transform, Viewport } from '@/core/types/index.js';
import { useHeatMapDispatch, useHeatMapState } from './useHeatMapState.js';
import { useReducedMotion } from './useReducedMotion.js';

const DURATION_MS = 600;

/** cubic-bezier(.4,0,.2,1) approximated as a cubic ease-in-out. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export interface ViewAnimation {
  /** Animates the viewport to fit a bounding box. */
  flyTo: (bbox: BBox) => void;
  /** Animates the viewport to an explicit transform — the reset path. */
  glideTo: (target: Transform) => void;
}

/**
 * Owns every animated change of the map transform.
 *
 * One hook rather than two so a fly-to and a reset cannot run at the same time:
 * they share the frame handle, and whichever starts second cancels the first.
 * Two independent animations would both dispatch every frame and the transform
 * would visibly fight itself.
 *
 * Under `prefers-reduced-motion` both become instant jumps — the
 * destination is identical either way, only the journey differs.
 */
export function useViewAnimation(viewport: Viewport): ViewAnimation {
  const dispatch = useHeatMapDispatch();
  const reducedMotion = useReducedMotion();
  const transform = useHeatMapState((state) => state.transform);

  // The animation reads the live transform without re-creating the callback on
  // every frame it dispatches — the same ref pattern useMapZoom uses for drag.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const frame = useRef<number | null>(null);

  // An animation still running at unmount would dispatch into a dead store on
  // its next frame.
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const glideTo = useCallback((target: Transform) => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    if (reducedMotion) {
      dispatch({ type: 'setTransform', transform: target });
      return;
    }

    // Captured once, before the first frame. Interpolating from the live value
    // each frame would ease toward a moving origin and never quite arrive.
    const from = transformRef.current;
    const start = performance.now();

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = ease(t);

      dispatch({
        type: 'setTransform',
        transform: {
          k: lerp(from.k, target.k, eased),
          x: lerp(from.x, target.x, eased),
          y: lerp(from.y, target.y, eased),
        },
      });

      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };

    frame.current = requestAnimationFrame(step);
  }, [dispatch, reducedMotion]);

  const flyTo = useCallback((bbox: BBox) => {
    if (viewport.width <= 0 || viewport.height <= 0) return;
    glideTo(computeFitTransform(bbox, viewport, { maxScale: MAX_ZOOM }));
  }, [glideTo, viewport]);

  return useMemo(() => ({ flyTo, glideTo }), [flyTo, glideTo]);
}
