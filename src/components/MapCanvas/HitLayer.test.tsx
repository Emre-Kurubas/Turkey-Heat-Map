import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';
import { HitLayer, type HitLayerProps } from './HitLayer.js';

const FEATURES: RenderFeature[] = [
  { code: '34', name: 'İstanbul', d: 'M0,0L10,0L10,10Z' },
  { code: '06', name: 'Ankara', d: 'M20,0L30,0L30,10Z' },
];
const VALUES = new Map([['34', 1234], ['06', 40]]);

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
  defaultFilters: { yearRange: [2015, 2024], categories: [] },
  yearBounds: [2015, 2024],
  flyToRequest: null,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderLayer(props: Partial<HitLayerProps> = {}) {
  const hoverStore = createHoverStore();
  const store = createHeatMapStore(base);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      <svg>{children}</svg>
    </HeatMapProvider>
  );
  const utils = render(
    <HitLayer
      features={FEATURES}
      values={VALUES}
      selectedCode={null}
      focusedCode={null}
      onSelect={() => {}}
      onFocusRegion={() => {}}
      formatValue={(v) => String(v)}
      {...props}
    />,
    { wrapper },
  );
  return { ...utils, hoverStore, store };
}

describe('HitLayer', () => {
  it('renders a transparent path per feature', () => {
    const { container } = renderLayer();
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('transparent');
  });

  it('labels each region with its name and value for screen readers', () => {
    renderLayer();
    expect(screen.getByRole('img', { name: /İstanbul/u }).getAttribute('aria-label'))
      .toContain('1234');
  });

  it('says "no data" for a region absent from the values map', () => {
    renderLayer({ values: new Map() });
    expect(screen.getByRole('img', { name: /İstanbul/u }).getAttribute('aria-label'))
      .toContain(trStrings.tooltip.noData);
  });

  it('publishes a hover target on pointer enter', () => {
    const { container, hoverStore } = renderLayer();
    const path = container.querySelector('path[data-code="34"]')!;
    fireEvent.pointerEnter(path, { clientX: 12, clientY: 34 });
    expect(hoverStore.getState()).toEqual({ code: '34', x: 12, y: 34, source: 'map' });
  });

  it('clears the hover target on pointer leave', () => {
    const { container, hoverStore } = renderLayer();
    const path = container.querySelector('path[data-code="34"]')!;
    fireEvent.pointerEnter(path, { clientX: 1, clientY: 2 });
    fireEvent.pointerLeave(path);
    expect(hoverStore.getState()).toBeNull();
  });

  it('selects a region on click', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect });
    fireEvent.click(container.querySelector('path[data-code="06"]')!);
    expect(onSelect).toHaveBeenCalledWith('06');
  });

  it('selects on Enter, so the map is operable without a pointer', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('06');
  });

  it('clears the selection on Escape', () => {
    const onSelect = vi.fn();
    const { container } = renderLayer({ onSelect, selectedCode: '06' });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('moves focus to the next region on ArrowRight', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '34' });
    fireEvent.keyDown(container.querySelector('path[data-code="34"]')!, { key: 'ArrowRight' });
    expect(onFocusRegion).toHaveBeenCalledWith('06');
  });

  it('moves focus to the previous region on ArrowLeft', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '06' });
    fireEvent.keyDown(container.querySelector('path[data-code="06"]')!, { key: 'ArrowLeft' });
    expect(onFocusRegion).toHaveBeenCalledWith('34');
  });

  it('stops at the ends rather than wrapping, so arrowing has a felt boundary', () => {
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onFocusRegion, focusedCode: '34' });
    fireEvent.keyDown(container.querySelector('path[data-code="34"]')!, { key: 'ArrowLeft' });
    expect(onFocusRegion).not.toHaveBeenCalled();
  });

  it('ignores an unhandled key', () => {
    const onSelect = vi.fn();
    const onFocusRegion = vi.fn();
    const { container } = renderLayer({ onSelect, onFocusRegion });
    fireEvent.keyDown(container.querySelector('path[data-code="34"]')!, { key: 'q' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onFocusRegion).not.toHaveBeenCalled();
  });

  it('puts exactly one region in the tab order', () => {
    const { container } = renderLayer({ focusedCode: '06' });
    const tabbable = [...container.querySelectorAll('path')]
      .filter((p) => p.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute('data-code')).toBe('06');
  });

  it('makes the first region tabbable when nothing is focused yet', () => {
    const { container } = renderLayer({ focusedCode: null });
    expect(container.querySelector('path[data-code="34"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('marks the selected region with aria-current', () => {
    const { container } = renderLayer({ selectedCode: '06' });
    expect(container.querySelector('path[data-code="06"]')?.getAttribute('aria-current'))
      .toBe('true');
  });

  it('honours the cull set', () => {
    const { container } = renderLayer({ visible: new Set(['34']) });
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });
});
