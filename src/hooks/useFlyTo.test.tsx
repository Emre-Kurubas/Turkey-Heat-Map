import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { BBox } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { useFlyTo } from './useFlyTo.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  metric: 'total',
  scaleMode: 'quantile',
};

const VIEWPORT = { width: 1000, height: 600 };
const TARGET: BBox = [[400, 200], [600, 400]];

/** Hand-driven clock and rAF queue, so the animation steps deterministically. */
let now = 0;
let frames: ((t: number) => void)[] = [];

function runFrames(toTime: number): void {
  now = toTime;
  const pending = frames;
  frames = [];
  for (const frame of pending) frame(now);
}

function setup(reducedMotion: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });

  const store = createHeatMapStore(base);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

beforeEach(() => { now = 0; frames = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useFlyTo', () => {
  it('jumps straight to the target under reduced motion', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    expect(store.getState().transform.k).toBeGreaterThan(1);
    // Nothing was scheduled: it was a jump, not an animation.
    expect(frames).toHaveLength(0);
  });

  it('animates over several frames when motion is allowed', () => {
    const { store, wrapper } = setup(false);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
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
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    act(() => { runFrames(600); });

    const { k, x, y } = store.getState().transform;
    // The target's centre must end up at the viewport's centre.
    expect(500 * k + x).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(300 * k + y).toBeCloseTo(VIEWPORT.height / 2, 0);
  });

  it('reaches the same destination under reduced motion as it does animated', () => {
    const jumped = setup(true);
    const jump = renderHook(() => useFlyTo(VIEWPORT), { wrapper: jumped.wrapper });
    act(() => { jump.result.current(TARGET); });
    const destination = jumped.store.getState().transform;

    vi.unstubAllGlobals();
    now = 0; frames = [];
    const animated = setup(false);
    const fly = renderHook(() => useFlyTo(VIEWPORT), { wrapper: animated.wrapper });
    act(() => { fly.result.current(TARGET); });
    act(() => { runFrames(600); });

    expect(animated.store.getState().transform).toEqual(destination);
  });

  it('stops scheduling once the animation is done', () => {
    const { wrapper } = setup(false);
    const { result } = renderHook(() => useFlyTo(VIEWPORT), { wrapper });

    act(() => { result.current(TARGET); });
    act(() => { runFrames(600); });
    expect(frames).toHaveLength(0);
  });

  it('is a no-op on an unmeasured viewport', () => {
    const { store, wrapper } = setup(true);
    const { result } = renderHook(() => useFlyTo({ width: 0, height: 0 }), { wrapper });

    act(() => { result.current(TARGET); });
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });
});
