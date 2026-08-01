import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { MapCanvas, type MapCanvasProps } from './MapCanvas.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'hirsizlik', count: 40 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2020], categories: [] },
  defaultFilters: { yearRange: [2020, 2020], categories: [] },
  yearBounds: [2020, 2020],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderCanvas(state: HeatMapState = base, props: Partial<MapCanvasProps> = {}) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  // jsdom reports every element as 0x0, so the ResizeObserver-driven viewport
  // never arrives. Pass an explicit size to exercise the rendering path.
  const utils = render(
    <MapCanvas
      data={DATA}
      categories={CATEGORIES}
      colorScale="spectral"
      heatStyle="glow"
      testViewport={{ width: 800, height: 500 }}
      {...props}
    />,
    { wrapper },
  );
  return { ...utils, store };
}

// Reduced motion makes a fly-to land in one step rather than needing frames.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('MapCanvas', () => {
  it('renders an accessible svg', () => {
    renderCanvas();
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('draws all four layers inside one transform group', () => {
    const { container } = renderCanvas();
    expect(container.querySelector('svg > defs')).not.toBeNull();
    expect(container.querySelectorAll('svg > g > g')).toHaveLength(4);
  });

  it('puts pan and zoom on a single transform group', () => {
    const { container } = renderCanvas({ ...base, transform: { k: 3, x: -100, y: -50 } });
    expect(container.querySelector('svg > g')?.getAttribute('transform'))
      .toBe('translate(-100,-50) scale(3)');
  });

  it('outlines 81 provinces at country zoom', () => {
    const { container } = renderCanvas();
    expect(container.querySelectorAll('path[role="img"]')).toHaveLength(81);
  });

  /**
   * The heat keeps district resolution at every zoom, so at country zoom the
   * painted layer is finer than the outlined one.
   */
  it('paints districts under province outlines at country zoom', () => {
    const { container } = renderCanvas();
    const groups = container.querySelectorAll('svg > g > g');
    const heat = groups[0]!;
    const borders = groups[1]!;

    expect(heat.querySelectorAll('path')).toHaveLength(973);
    expect(borders.querySelectorAll('path')).toHaveLength(81);

    // Painted codes are districts; outlined codes are provinces.
    expect(heat.querySelector('path')?.getAttribute('data-code')).toMatch(/^\d{4}$/u);
    expect(borders.querySelector('path')?.getAttribute('data-code')).toMatch(/^\d{2}$/u);
  });

  it('reports province totals from the outline level, not district totals', () => {
    renderCanvas();
    expect(screen.getByRole('img', { name: /İstanbul/u }).getAttribute('aria-label'))
      .toContain('100');
  });

  it('drops the heat to provinces when the data carries no district codes', () => {
    const ilOnly: CrimeRecord[] = [
      { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
    ];
    const { container } = renderCanvas(base, { data: ilOnly });
    const heat = container.querySelectorAll('svg > g > g')[0]!;
    expect(heat.querySelectorAll('path')).toHaveLength(81);
  });

  it('holds the blur in projected space, so districts stay soft when zoomed', () => {
    // Scaling it down with the zoom sharpened the heat into flat polygons at
    // exactly the scale where the district detail lives. Constant here means
    // the softness is proportional to the regions rather than to the screen —
    // and it takes the transform out of the filter's inputs, so panning and
    // zooming never re-run the blur.
    const { container: a } = renderCanvas();
    const { container: b } = renderCanvas({ ...base, transform: { k: 4, x: 0, y: 0 } });
    const read = (c: HTMLElement) =>
      Number(c.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'));
    expect(read(b)).toBe(read(a));
    expect(read(a)).toBeGreaterThan(0);
  });

  it('reports a region click to the consumer', () => {
    const onRegionClick = vi.fn();
    const { container } = renderCanvas(base, { onRegionClick });
    (container.querySelector('path[data-code="34"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onRegionClick).toHaveBeenCalledWith(
      expect.objectContaining({ code: '34', name: 'İstanbul', value: 100 }),
    );
  });

  it('reports a null value for a region with no records', () => {
    const onRegionClick = vi.fn();
    const { container } = renderCanvas(base, { onRegionClick });
    (container.querySelector('path[data-code="35"][role="img"]') as SVGPathElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onRegionClick).toHaveBeenCalledWith(
      expect.objectContaining({ code: '35', value: null }),
    );
  });

  it('announces the loading state before the container is measured', () => {
    renderCanvas(base, { testViewport: { width: 0, height: 0 } });
    expect(screen.getByText(trStrings.map.loading)).toBeInTheDocument();
  });

  it('gives each instance its own filter ids so two maps cannot collide', () => {
    const { container: a } = renderCanvas();
    const { container: b } = renderCanvas();
    const idOf = (c: HTMLElement) => c.querySelector('filter')?.getAttribute('id');
    expect(idOf(a)).not.toBe(idOf(b));
  });

  it('corrects an inconsistent starting level to match the zoom scale', () => {
    // Level follows zoom, so 'ilce' at k=1 is not a reachable state: the hook
    // drops back to provinces rather than rendering districts at country zoom.
    const { container, store } = renderCanvas({ ...base, level: 'ilce' });
    expect(store.getState().level).toBe('il');
    expect(container.querySelectorAll('path[role="img"]')).toHaveLength(81);
  });

  it('outlines districts, culled to the viewport, once zoomed past the threshold', () => {
    const { container, store } = renderCanvas({
      ...base, level: 'ilce', transform: { k: 3, x: 0, y: 0 },
    });
    expect(store.getState().level).toBe('ilce');

    const codes = [...container.querySelectorAll('path[role="img"]')]
      .map((p) => p.getAttribute('data-code') ?? '');
    expect(codes.length).toBeGreaterThan(0);
    // At k=3 roughly a ninth of the country is on screen; drawing all 973 would
    // mean the cull set is not reaching the layers.
    expect(codes.length).toBeLessThan(973);
    for (const code of codes) expect(code).toMatch(/^\d{4}$/u);
  });

  it('reports district totals once districts are the outlined level', () => {
    renderCanvas({ ...base, level: 'ilce', transform: { k: 3, x: 0, y: 0 } });
    expect(screen.getByRole('img', { name: /Adalar/u }).getAttribute('aria-label'))
      .toContain('100');
  });
});

describe('MapCanvas — fly-to requests from other panels', () => {
  it('flies to a region requested through the store', () => {
    const { store } = renderCanvas();
    const before = store.getState().transform;

    act(() => { store.dispatch({ type: 'requestFlyTo', code: '34' }); });
    expect(store.getState().transform).not.toEqual(before);
  });

  it('clears the request so the same region can be requested again', () => {
    const { store } = renderCanvas();
    act(() => { store.dispatch({ type: 'requestFlyTo', code: '34' }); });
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('ignores a request for a region it has no geometry for', () => {
    const { store } = renderCanvas();
    const before = store.getState().transform;

    act(() => { store.dispatch({ type: 'requestFlyTo', code: 'yok' }); });
    expect(store.getState().transform).toEqual(before);
    expect(store.getState().flyToRequest).toBeNull();
  });
});

describe('MapCanvas — returning to the country view', () => {
  const zoomedIn: HeatMapState = {
    ...base,
    transform: { k: 6, x: -1200, y: -700 },
    level: 'ilce',
  };

  it('travels back to the default view when a panel asks for it', () => {
    const { store } = renderCanvas(zoomedIn);

    act(() => { store.dispatch({ type: 'requestViewReset' }); });
    // Reduced motion is stubbed on, so the journey lands in one step here; the
    // 600ms easing itself is covered in useViewAnimation's own tests.
    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('lets the level follow the scale back up to provinces', () => {
    const { store } = renderCanvas(zoomedIn);

    act(() => { store.dispatch({ type: 'requestViewReset' }); });
    expect(store.getState().level).toBe('il');
  });

  it('answers a second request, having already served the first', () => {
    // The regression a boolean flag would cause: drill in, close, drill in,
    // close — and the second close does nothing because the flag never reset.
    const { store } = renderCanvas(zoomedIn);

    act(() => { store.dispatch({ type: 'requestViewReset' }); });
    act(() => { store.dispatch({ type: 'setTransform', transform: { k: 6, x: -1200, y: -700 } }); });
    act(() => { store.dispatch({ type: 'requestViewReset' }); });

    expect(store.getState().transform).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('does not travel anywhere on mount, whatever the request count started at', () => {
    // The effect compares against what it saw last, seeded at mount. A naive
    // truthiness check would fire on any nonzero initial value and yank a
    // consumer's `defaultView` back to the whole country on first paint.
    const { store } = renderCanvas({ ...zoomedIn, viewResetRequest: 7 });
    expect(store.getState().transform).toEqual(zoomedIn.transform);
  });
});

describe('MapCanvas — opening a region detail', () => {
  it('opens the detail panel for a clicked province', () => {
    const { container, store } = renderCanvas();
    fireEvent.click(container.querySelector('path[data-code="34"][role="img"]')!);

    expect(store.getState().detail).toEqual({ code: '34', level: 'il' });
  });

  it('also flies toward a clicked province, which crosses the district threshold', () => {
    const { container, store } = renderCanvas();
    const before = store.getState().transform;

    fireEvent.click(container.querySelector('path[data-code="34"][role="img"]')!);

    expect(store.getState().transform).not.toEqual(before);
    expect(store.getState().transform.k).toBeGreaterThan(2.65);
  });

  it('keeps the province panel open through the level change the zoom causes', () => {
    const { container, store } = renderCanvas();
    fireEvent.click(container.querySelector('path[data-code="34"][role="img"]')!);

    act(() => { store.dispatch({ type: 'setLevel', level: 'ilce' }); });
    expect(store.getState().detail).toEqual({ code: '34', level: 'il' });
  });

  it('opens a district panel without flying, since it is already in view', () => {
    const { container, store } = renderCanvas({
      ...base, level: 'ilce', transform: { k: 3, x: 0, y: 0 },
    });
    const district = container.querySelector('path[role="img"]') as SVGPathElement;
    const code = district.getAttribute('data-code')!;
    const before = store.getState().transform;

    fireEvent.click(district);

    expect(store.getState().detail).toEqual({ code, level: 'ilce' });
    expect(store.getState().transform).toEqual(before);
  });
});

describe('MapCanvas — knowing which province you are inside', () => {
  const drilledIn: HeatMapState = {
    ...base,
    transform: { k: 6, x: -1200, y: -700 },
    level: 'ilce',
    detail: { code: '34', level: 'il' },
  };

  it('outlines the open province once districts are what is drawn', () => {
    const { container } = renderCanvas(drilledIn);
    expect(container.querySelector('[data-role="context"][data-code="34"]')).not.toBeNull();
  });

  it('draws no such outline at country zoom, where province borders already exist', () => {
    const { container } = renderCanvas({ ...base, detail: { code: '34', level: 'il' } });
    expect(container.querySelector('[data-role="context"]')).toBeNull();
  });

  it('draws none when the open panel is itself a district', () => {
    // A district's own boundary is already one of the outlined features.
    const { container } = renderCanvas({
      ...drilledIn, detail: { code: '3401', level: 'ilce' },
    });
    expect(container.querySelector('[data-role="context"]')).toBeNull();
  });

  it('draws none when no panel is open', () => {
    const { container } = renderCanvas({ ...drilledIn, detail: null });
    expect(container.querySelector('[data-role="context"]')).toBeNull();
  });

  it('follows the panel rather than the selection', () => {
    // The selection is cleared by the level change that the drill-in causes, so
    // reading it here would lose the boundary at exactly the moment it matters.
    const { container } = renderCanvas({ ...drilledIn, selectedCode: null });
    expect(container.querySelector('[data-role="context"][data-code="34"]')).not.toBeNull();
  });
});
