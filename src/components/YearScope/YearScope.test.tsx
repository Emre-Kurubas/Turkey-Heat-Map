import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { trStrings } from '@/i18n/index.js';
import { YearScope } from './YearScope.js';

const DEFAULTS = { yearRange: [2015, 2024] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: DEFAULTS,
  defaultFilters: DEFAULTS,
  yearBounds: [2015, 2024],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderScope(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  return { ...render(<YearScope />, { wrapper }), store };
}

/** The whole card, for "is this stated anywhere" assertions. */
function scopeText(container: HTMLElement): string {
  return container.querySelector('[data-role="year-scope"]')?.textContent ?? '';
}

/** Just the headline range, for assertions about how it is written. */
function valueText(container: HTMLElement): string {
  return container.querySelector('[data-role="year-value"]')?.textContent?.trim() ?? '';
}

describe('YearScope', () => {
  it('writes the full span when nothing is filtered', () => {
    const { container } = renderScope();
    expect(scopeText(container)).toContain('2015–2024');
  });

  it('names what the number is, so it is not a bare pair of years', () => {
    const { container } = renderScope();
    expect(scopeText(container)).toContain(trStrings.filters.yearRange);
  });

  it('follows the filter rather than the data bounds', () => {
    // The two agree until someone narrows the range, which is precisely when
    // the caption starts earning its place.
    const { container } = renderScope({
      ...base,
      filters: { ...DEFAULTS, yearRange: [2018, 2020] },
    });
    expect(scopeText(container)).toContain('2018–2020');
  });

  it('collapses a single-year selection to one number', () => {
    // What clicking a point on the trend chart produces. "2020–2020" reads as a
    // span the reader did not ask for.
    const { container } = renderScope({
      ...base,
      filters: { ...DEFAULTS, yearRange: [2020, 2020] },
    });
    expect(valueText(container)).toBe('2020');
  });

  it('updates when the filter moves', () => {
    const { container, store } = renderScope();
    act(() => { store.dispatch({ type: 'setYearRange', range: [2019, 2019] }); });
    expect(valueText(container)).toBe('2019');
  });

  it('sits on a panel, like every other control over the map', () => {
    // It is something to press, and a slider floating on a moving heat map has
    // no stable backdrop for its track.
    const { container } = renderScope();
    expect(container.querySelector('[class*="panel"]')).not.toBeNull();
  });

  it('is named once, not twice', () => {
    // The panel deliberately carries no label of its own: the slider inside is
    // already a group by that name, and nesting two would announce it twice.
    renderScope();
    expect(screen.getAllByRole('group', { name: trStrings.filters.yearRange }))
      .toHaveLength(1);
  });
});

describe('YearScope — setting the range', () => {
  it('offers the two handles that set it', () => {
    renderScope();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('spans the data bounds, not the current selection', () => {
    // Narrowing the range must not narrow what you can drag back out to.
    renderScope({ ...base, filters: { ...DEFAULTS, yearRange: [2018, 2020] } });
    const handles = screen.getAllByRole('slider');
    expect(handles[0]).toHaveAttribute('aria-valuemin', '2015');
    expect(handles[1]).toHaveAttribute('aria-valuemax', '2024');
  });

  it('writes a keyboard change into the store', () => {
    const { store } = renderScope();
    fireEvent.keyDown(screen.getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(store.getState().filters.yearRange).toEqual([2016, 2024]);
  });

  it('moves the high handle independently', () => {
    const { store } = renderScope();
    fireEvent.keyDown(screen.getAllByRole('slider')[1]!, { key: 'ArrowLeft' });
    expect(store.getState().filters.yearRange).toEqual([2015, 2023]);
  });

  it('prints the range once, not twice', () => {
    // The caption is the readout; the slider's own is switched off.
    const { container } = renderScope();
    expect(container.querySelectorAll('[class*="readout"]')).toHaveLength(0);
  });
});

describe('YearScope — the scale under the track', () => {
  const labels = (container: HTMLElement): string[] =>
    [...container.querySelectorAll('[data-role="scale-label"]')]
      .map((node) => node.textContent ?? '');

  it('writes a scale under the track, ends included', () => {
    // Without one the handles sit at two unlabelled positions and there is no
    // way to tell how much of the data the selection covers.
    const { container } = renderScope();
    expect(labels(container)[0]).toBe('2015');
    expect(labels(container).at(-1)).toBe('2024');
  });

  it('thins the labels rather than colliding ten four-digit years', () => {
    // A nine-year span divides evenly by three, so four labels three years
    // apart — aligned to real steps, not to fractions of the track.
    const { container } = renderScope();
    expect(labels(container)).toEqual(['2015', '2018', '2021', '2024']);
  });

  it('marks the labels the selection covers', () => {
    const { container } = renderScope({
      ...base,
      filters: { ...DEFAULTS, yearRange: [2018, 2021] },
    });
    const inside = [...container.querySelectorAll('[data-role="scale-label"][data-inside="true"]')]
      .map((node) => node.textContent);
    expect(inside).toEqual(['2018', '2021']);
  });

  it('segments the track between the years, not across its rounded ends', () => {
    // Eight dividers for ten years: one between each adjacent pair, and none
    // under the pill's own curve where it would be clipped to a sliver.
    const { container } = renderScope();
    expect(container.querySelectorAll('[data-role="tick"]')).toHaveLength(8);
  });

  it('marks the segments the selection covers on the track itself', () => {
    const { container } = renderScope({
      ...base,
      filters: { ...DEFAULTS, yearRange: [2018, 2020] },
    });
    const inside = container.querySelectorAll('[data-role="tick"][data-inside="true"]');
    expect(inside).toHaveLength(3);
  });
});
