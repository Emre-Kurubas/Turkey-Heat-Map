import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { deriveLevel, panBy, zoomAt } from '@/core/geo/index.js';
import type { GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { LEVEL_HYSTERESIS, LEVEL_THRESHOLD } from '@/data/geo/index.js';
import { useHeatMapDispatch, useHeatMapState } from './useHeatMapState.js';

/** One wheel notch. Multiplicative so zooming feels even at every scale. */
const WHEEL_STEP = 1.2;
const BUTTON_STEP = 1.5;

export interface MapZoomHandlers {
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
}

export interface MapZoom {
  transform: Transform;
  level: GeoLevel;
  handlers: MapZoomHandlers;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

/**
 * Owns pan, zoom, and the level that follows from the zoom scale.
 *
 * The drag origin lives in a ref, not state: a re-render per pointermove would
 * cost the 60 fps budget in §9, and nothing renders from it anyway.
 */
export function useMapZoom(viewport: Viewport): MapZoom {
  const transform = useHeatMapState((state) => state.transform);
  const level = useHeatMapState((state) => state.level);
  const dispatch = useHeatMapDispatch();

  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Level follows scale, and is written back so every panel reads one source of
  // truth. Hysteresis lives in deriveLevel, so this is safe to run every change.
  useEffect(() => {
    const next = deriveLevel(transform.k, level, LEVEL_THRESHOLD, LEVEL_HYSTERESIS);
    if (next !== level) dispatch({ type: 'setLevel', level: next });
  }, [transform.k, level, dispatch]);

  const applyZoom = useCallback((factor: number, point: readonly [number, number]) => {
    dispatch({
      type: 'setTransform',
      transform: zoomAt(transformRef.current, factor, point, viewport),
    });
  }, [dispatch, viewport]);

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    applyZoom(factor, [event.clientX - rect.left, event.clientY - rect.top]);
  }, [applyZoom]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dispatch({
      type: 'setTransform',
      transform: panBy(transformRef.current, dx, dy, viewport),
    });
  }, [dispatch, viewport]);

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const zoomIn = useCallback(() => {
    applyZoom(BUTTON_STEP, [viewport.width / 2, viewport.height / 2]);
  }, [applyZoom, viewport]);

  const zoomOut = useCallback(() => {
    applyZoom(1 / BUTTON_STEP, [viewport.width / 2, viewport.height / 2]);
  }, [applyZoom, viewport]);

  const reset = useCallback(() => { dispatch({ type: 'resetView' }); }, [dispatch]);

  return {
    transform,
    level,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
    zoomIn,
    zoomOut,
    reset,
  };
}
