import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { BBox } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { useViewAnimation } from './useViewAnimation.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

const VIEWPORT = { width: 1000, height: 600 };
const TARGET: BBox = [[400, 200], [600, 400]];

/**
 * Hand-driven clock and rAF queue, so the animation steps deterministically.
 *
 * Keyed by handle rather than held in an array, so the stubbed
 * `cancelAnimationFrame` can really cancel. A no-op stub would let a superseded
 * animation keep running in the test and nowhere else, which is precisely the
 * bug the interrupt case exists to catch.
 */
let now = 0;
let nextHandle = 1;
let frames = new Map<number, (t: number) => void>();

function runFrames(toTime: number): void {
  now = toTime;
  const pending = [...frames.values()];
  frames.clear();
  for (const frame of pending) frame(now);
}

function setup(reducedMotion: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    const handle = nextHandle;
    nextHandle += 1;
    frames.set(handle, cb);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => { frames.delete(handle); });
  vi.stubGlobal('performance', { now: () => now });

  const store = createHeatMapStore(base);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

beforeEach(() => { now = 0; nextHandle = 1; frames = new Map(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useViewAnimation', () => {
  it('jumps straight to the target under reduced motion', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    expect(store.getState().transform.k).toBeGreaterThan(1);
    // Nothing was scheduled: it was a jump, not an animation.
    expect(frames.size).toBe(0);
  });

  it('animates over several frames when motion is allowed', () => {
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    // Scheduled, but nothing applied until the first frame runs.
    expect(store.getState().transform.k).toBe(1);

    act(() => { runFrames(300); });
    const midway = store.getState().transform.k;
    expect(midway).toBeGreaterThan(1);

    act(() => { runFrames(600); });
    expect(store.getState().transform.k).toBeGreaterThan(midway);
  });

  it('lands exactly on the fitted transform when the animation completes', () => {
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    act(() => { runFrames(600); });

    const { k, x, y } = store.getState().transform;
    // The target's centre must end up at the viewport's centre.
    expect(500 * k + x).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(300 * k + y).toBeCloseTo(VIEWPORT.height / 2, 0);
  });

  it('reaches the same destination under reduced motion as it does animated', () => {
    const jumped = setup(true);
    const jump = renderHook(() => useViewAnimation(VIEWPORT), { wrapper: jumped.wrapper });
    act(() => { jump.result.current.flyTo(TARGET); });
    const destination = jumped.store.getState().transform;

    vi.unstubAllGlobals();
    now = 0; nextHandle = 1; frames = new Map();
    const animated = setup(false);
    const fly = renderHook(() => useViewAnimation(VIEWPORT), { wrapper: animated.wrapper });
    act(() => { fly.result.current.flyTo(TARGET); });
    act(() => { runFrames(600); });

    expect(animated.store.getState().transform).toEqual(destination);
  });

  it('stops scheduling once the animation is done', () => {
    const { wrapper } = setup(false);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    act(() => { runFrames(600); });
    expect(frames.size).toBe(0);
  });

  it('is a no-op on an unmeasured viewport', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(() => useViewAnimation({ width: 0, height: 0 }), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });
});

describe('useViewAnimation — glideTo', () => {
  const ZOOMED_IN: HeatMapState = { ...base, transform: { k: 4, x: -900, y: -500 } };

  function setupZoomed(reducedMotion: boolean) {
    const context = setup(reducedMotion);
    context.store.dispatch({ type: 'setTransform', transform: ZOOMED_IN.transform });
    return context;
  }

  it('eases back to the identity transform rather than snapping', () => {
    const { store, wrapper } = setupZoomed(false);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.glideTo({ k: 1, x: 0, y: 0 }); });
    // Still where it was: the reset is scheduled, not applied.
    expect(store.getState().transform.k).toBe(4);

    act(() => { runFrames(300); });
    const midway = store.getState().transform.k;
    expect(midway).toBeLessThan(4);
    expect(midway).toBeGreaterThan(1);

    act(() => { runFrames(600); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('snaps home under reduced motion', () => {
    const { store, wrapper } = setupZoomed(true);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.glideTo({ k: 1, x: 0, y: 0 }); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
    expect(frames.size).toBe(0);
  });

  it('lets a reset interrupt a fly-to instead of fighting it', () => {
    // Both animations share one frame handle, so the second cancels the first.
    // Two live tweens would each dispatch every frame and the map would judder.
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useViewAnimation(VIEWPORT), { wrapper });

    act(() => { result.current.flyTo(TARGET); });
    act(() => { runFrames(200); });
    act(() => { result.current.glideTo({ k: 1, x: 0, y: 0 }); });
    act(() => { runFrames(900); });

    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
    expect(frames.size).toBe(0);
  });

  it('still works when the viewport has never been measured', () => {
    // Unlike flyTo, which needs a viewport to fit a box into, the destination
    // here is already known — a reset must not be blocked by an unmeasured box.
    const { store, wrapper } = setupZoomed(true);
    const { result } = renderHook(
      () => useViewAnimation({ width: 0, height: 0 }),
      { wrapper },
    );

    act(() => { result.current.glideTo({ k: 1, x: 0, y: 0 }); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });
});
