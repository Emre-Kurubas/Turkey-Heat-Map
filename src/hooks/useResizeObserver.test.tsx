import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResizeObserver } from './useResizeObserver.js';

type Cb = (entries: { contentRect: { width: number; height: number } }[]) => void;
let callbacks: Cb[] = [];

function installResizeObserver(): void {
  callbacks = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: Cb) { callbacks.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
}

afterEach(() => { vi.unstubAllGlobals(); callbacks = []; });

describe('useResizeObserver', () => {
  it('starts at zero, which callers must treat as "not measured yet"', () => {
    installResizeObserver();
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });

  it('reports the observed size', () => {
    installResizeObserver();
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());

    act(() => {
      for (const cb of callbacks) cb([{ contentRect: { width: 800, height: 600 } }]);
    });
    expect(result.current[1]).toEqual({ width: 800, height: 600 });
  });

  it('rounds fractional sizes so the projection does not thrash on sub-pixel changes', () => {
    installResizeObserver();
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());

    act(() => { for (const cb of callbacks) cb([{ contentRect: { width: 800.4, height: 599.6 } }]); });
    expect(result.current[1]).toEqual({ width: 800, height: 600 });
  });

  it('ignores a repeated identical size', () => {
    installResizeObserver();
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());

    act(() => { for (const cb of callbacks) cb([{ contentRect: { width: 800, height: 600 } }]); });
    const first = result.current[1];
    act(() => { for (const cb of callbacks) cb([{ contentRect: { width: 800, height: 600 } }]); });
    expect(result.current[1]).toBe(first);
  });

  it('ignores an observation carrying no entry', () => {
    installResizeObserver();
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());

    act(() => { for (const cb of callbacks) cb([]); });
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });

  it('stays at zero when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });
});
