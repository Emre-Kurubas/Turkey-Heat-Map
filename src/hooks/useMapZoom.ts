import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { deriveLevel, panBy, zoomAt } from '@/core/geo/index.js';
import type { GeoLevel, Transform, Viewport } from '@/core/types/index.js';
import { LEVEL_HYSTERESIS, LEVEL_THRESHOLD } from '@/data/geo/index.js';
import { useHeatMapDispatch, useHeatMapState } from './useHeatMapState.js';

/** One wheel notch. Multiplicative so zooming feels even at every scale. */
const WHEEL_STEP = 1.2;
const BUTTON_STEP = 1.5;

/**
 * How far the pointer must travel before a press counts as a pan, in CSS pixels.
 *
 * Small enough that a deliberate drag feels immediate, large enough to absorb
 * the two or three pixels a hand moves during an ordinary click.
 */
const DRAG_THRESHOLD = 4;

export interface MapZoomHandlers {
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
}

export interface MapZoom {
  transform: Transform;
  level: GeoLevel;
  handlers: MapZoomHandlers;
  /**
   * Callback ref for the `<svg>`. Carries the wheel listener, which cannot go
   * through React's `onWheel`.
   */
  svgRef: (node: SVGSVGElement | null) => void;
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

  /**
   * `panning` is what makes region clicks work.
   *
   * Capturing the pointer on pointerdown broke them: while a pointer is
   * captured, the browser dispatches the following `click` to the *capture
   * target* — the `<svg>` — rather than to the element under the cursor, so the
   * region path's own handler never ran and nothing on the map was clickable.
   *
   * Capture is only needed once a drag is actually under way, so it is deferred
   * until the pointer passes DRAG_THRESHOLD. A press that never moves never
   * captures, and its click reaches the region. The same flag doubles as the
   * guard against a pan ending in an accidental selection: a real drag *does*
   * capture, which routes that click to the svg and away from the region.
   */
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    panning: boolean;
  } | null>(null);
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

  /*
   * Wheel is bound imperatively, not through React's `onWheel`.
   *
   * React registers wheel listeners as passive, so `preventDefault()` inside a
   * JSX handler is ignored and logs a console error — the map would zoom while
   * the host page also scrolled underneath it. Only an explicitly non-passive
   * listener can cancel the default, and that requires the DOM node.
   */
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgNode === null) return;

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = svgNode.getBoundingClientRect();
      const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      applyZoom(factor, [event.clientX - rect.left, event.clientY - rect.top]);
    };

    svgNode.addEventListener('wheel', onWheel, { passive: false });
    return () => { svgNode.removeEventListener('wheel', onWheel); };
  }, [svgNode, applyZoom]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    // Deliberately no setPointerCapture here — see the ref's comment.
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      panning: false,
    };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;

    if (!active.panning) {
      const far = Math.abs(event.clientX - active.originX) > DRAG_THRESHOLD
        || Math.abs(event.clientY - active.originY) > DRAG_THRESHOLD;
      // Still within the slop of a click. Do not pan, and do not capture.
      if (!far) return;
      active.panning = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;
    dispatch({
      type: 'setTransform',
      transform: panBy(transformRef.current, dx, dy, viewport),
    });
  }, [dispatch, viewport]);

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (active === null) return;
    drag.current = null;
    // Only a drag ever took capture, so only a drag releases it.
    if (active.panning && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    handlers: { onPointerDown, onPointerMove, onPointerUp },
    svgRef: setSvgNode,
    zoomIn,
    zoomOut,
    reset,
  };
}
