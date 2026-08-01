import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { MapCanvas, type MapCanvasProps } from './MapCanvas.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', category: 'hirsizlik', count: 40 },
];

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2020, 2020], categories: [] },
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

  it('renders 81 hit targets at il level', () => {
    const { container } = renderCanvas();
    expect(container.querySelectorAll('path[role="img"]')).toHaveLength(81);
  });

  it('scales the blur down as zoom rises, so softness looks constant', () => {
    const { container: a } = renderCanvas();
    const { container: b } = renderCanvas({ ...base, transform: { k: 4, x: 0, y: 0 } });
    const read = (c: HTMLElement) =>
      Number(c.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'));
    expect(read(b)).toBeLessThan(read(a));
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

  it('renders districts, culled to the viewport, once zoomed past the threshold', () => {
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
});
