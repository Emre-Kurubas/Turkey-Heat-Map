import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget, useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import { trStrings } from '@/i18n/index.js';
import { HeatMapProvider } from './HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from './HeatMapStore.js';
import { createHoverStore } from './HoverStore.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  metric: 'total',
  scaleMode: 'quantile',
};

function wrapperWith(store = createHeatMapStore(base), hoverStore = createHoverStore()) {
  return {
    store,
    hoverStore,
    wrapper: ({ children }: { children: ReactNode }) => (
      <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
        {children}
      </HeatMapProvider>
    ),
  };
}

describe('HeatMapProvider', () => {
  it('provides the string table', () => {
    const { wrapper } = wrapperWith();
    const { result } = renderHook(() => useStrings(), { wrapper });
    expect(result.current.level.il).toBe('İl');
  });

  it('re-renders a subscriber when its slice changes', () => {
    const { store, wrapper } = wrapperWith();
    const { result } = renderHook(() => useHeatMapState((s) => s.level), { wrapper });
    expect(result.current).toBe('il');

    act(() => { store.dispatch({ type: 'setLevel', level: 'ilce' }); });
    expect(result.current).toBe('ilce');
  });

  it('does not re-render a subscriber whose slice is untouched', () => {
    const { store, wrapper } = wrapperWith();
    const renders = vi.fn();
    renderHook(() => { renders(); return useHeatMapState((s) => s.level); }, { wrapper });
    const before = renders.mock.calls.length;

    act(() => { store.dispatch({ type: 'select', code: '34' }); });
    expect(renders.mock.calls.length).toBe(before);
  });

  it('keeps hover state out of the main store', () => {
    const { store, wrapper } = wrapperWith();
    const { result } = renderHook(
      () => ({ hover: useHoverTarget(), setHover: useSetHoverTarget() }),
      { wrapper },
    );

    act(() => { result.current.setHover({ type: 'enter', target: { code: '34', x: 5, y: 6 } }); });
    expect(result.current.hover).toEqual({ code: '34', x: 5, y: 6 });
    expect(store.getState().selectedCode).toBeNull();
  });

  it('does not re-render main-store subscribers on hover', () => {
    const { wrapper, hoverStore } = wrapperWith();
    const renders = vi.fn();
    renderHook(() => { renders(); return useHeatMapState((s) => s.level); }, { wrapper });
    const before = renders.mock.calls.length;

    act(() => { hoverStore.dispatch({ type: 'enter', target: { code: '34', x: 1, y: 2 } }); });
    expect(renders.mock.calls.length).toBe(before);
  });

  it('throws a clear error when used outside the provider', () => {
    // React logs the thrown error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() { useStrings(); return null; }
    expect(() => render(<Orphan />)).toThrow(/<CrimeHeatMap> içinde/u);
    spy.mockRestore();
  });

  it('renders children', () => {
    const { wrapper: Wrapper } = wrapperWith();
    render(<Wrapper>çocuk</Wrapper>);
    expect(screen.getByText('çocuk')).toBeInTheDocument();
  });
});
