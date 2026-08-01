import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { useMapZoom } from './useMapZoom.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function setup(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { store, wrapper };
}

const VIEWPORT = { width: 1000, height: 600 };

/** A pointer event carrying only what the handlers actually read. */
function pointer(overrides: Record<string, unknown>) {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    currentTarget: {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    },
    preventDefault: () => {},
    ...overrides,
  } as never;
}

describe('useMapZoom', () => {
  it('starts at identity', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });
    expect(result.current.transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('zooms in and out through the exposed controls', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.zoomIn(); });
    expect(result.current.transform.k).toBeGreaterThan(1);

    const zoomed = result.current.transform.k;
    act(() => { result.current.zoomOut(); });
    expect(result.current.transform.k).toBeLessThan(zoomed);
  });

  it('switches to ilçe once zoomed past the threshold', () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.zoomIn(); });
    act(() => { result.current.zoomIn(); });
    act(() => { result.current.zoomIn(); });

    expect(result.current.transform.k).toBeGreaterThan(2.65);
    expect(store.getState().level).toBe('ilce');
  });

  it('does not flicker level while the scale sits inside the dead band', () => {
    const { store, wrapper } = setup({ ...base, transform: { k: 2.5, x: 0, y: 0 } });
    renderHook(() => useMapZoom(VIEWPORT), { wrapper });
    expect(store.getState().level).toBe('il');
  });

  it('resets the view', () => {
    const { wrapper } = setup({ ...base, transform: { k: 5, x: -100, y: -50 }, level: 'ilce' });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.reset(); });
    expect(result.current.transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('zooms toward the pointer on wheel', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onWheel(pointer({ deltaY: -100, clientX: 200, clientY: 150 }));
    });
    expect(result.current.transform.k).toBeGreaterThan(1);
  });

  it('zooms out on a downward wheel', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -100, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onWheel(pointer({ deltaY: 100, clientX: 200, clientY: 150 }));
    });
    expect(result.current.transform.k).toBeLessThan(4);
  });

  it('pans on pointer drag', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    });
    act(() => {
      result.current.handlers.onPointerMove(pointer({ clientX: 80, clientY: 90 }));
    });

    expect(result.current.transform.x).toBe(-220);
    expect(result.current.transform.y).toBe(-110);
  });

  it('ignores pointer movement when no drag is in progress', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.handlers.onPointerMove(pointer({ clientX: 0, clientY: 0 })); });
    expect(result.current.transform.x).toBe(-200);
  });

  it('ignores a non-primary button, leaving right-drag to the host page', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerDown(pointer({ button: 2, clientX: 100, clientY: 100 }));
    });
    act(() => { result.current.handlers.onPointerMove(pointer({ clientX: 80, clientY: 90 })); });
    expect(result.current.transform.x).toBe(-200);
  });

  it('ignores movement from a different pointer than the one that started the drag', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => {
      result.current.handlers.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    });
    act(() => {
      result.current.handlers.onPointerMove(pointer({ pointerId: 2, clientX: 0, clientY: 0 }));
    });
    expect(result.current.transform.x).toBe(-200);
  });

  it('stops panning after pointer up', () => {
    const { wrapper } = setup({ ...base, transform: { k: 4, x: -200, y: -100 } });
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });

    act(() => { result.current.handlers.onPointerDown(pointer({ clientX: 100, clientY: 100 })); });
    act(() => { result.current.handlers.onPointerUp(pointer({})); });
    act(() => { result.current.handlers.onPointerMove(pointer({ clientX: 0, clientY: 0 })); });
    expect(result.current.transform.x).toBe(-200);
  });

  it('tolerates a pointer up with no drag in progress', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMapZoom(VIEWPORT), { wrapper });
    expect(() => {
      act(() => { result.current.handlers.onPointerUp(pointer({})); });
    }).not.toThrow();
  });
});
