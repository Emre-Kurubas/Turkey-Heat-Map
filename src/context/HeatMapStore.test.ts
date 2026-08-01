import { describe, expect, it, vi } from 'vitest';
import { createHeatMapStore, heatMapReducer, type HeatMapState } from './HeatMapStore.js';

const DEFAULT_FILTERS = { yearRange: [2015, 2024] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: DEFAULT_FILTERS,
  defaultFilters: DEFAULT_FILTERS,
  yearBounds: [2015, 2024],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

describe('heatMapReducer', () => {
  it('sets the transform', () => {
    const next = heatMapReducer(base, { type: 'setTransform', transform: { k: 3, x: 10, y: 20 } });
    expect(next.transform).toEqual({ k: 3, x: 10, y: 20 });
  });

  it('sets the level', () => {
    expect(heatMapReducer(base, { type: 'setLevel', level: 'ilce' }).level).toBe('ilce');
  });

  it('clears the selection when the level changes, since codes are level-specific', () => {
    const selected: HeatMapState = { ...base, selectedCode: '34' };
    expect(heatMapReducer(selected, { type: 'setLevel', level: 'ilce' }).selectedCode).toBeNull();
  });

  it('returns the same object when the level does not change', () => {
    const selected: HeatMapState = { ...base, selectedCode: '34' };
    expect(heatMapReducer(selected, { type: 'setLevel', level: 'il' })).toBe(selected);
  });

  it('selects and deselects a region', () => {
    const selected = heatMapReducer(base, { type: 'select', code: '06' });
    expect(selected.selectedCode).toBe('06');
    expect(heatMapReducer(selected, { type: 'select', code: null }).selectedCode).toBeNull();
  });

  it('moves keyboard focus independently of selection', () => {
    const next = heatMapReducer(base, { type: 'focus', code: '35' });
    expect(next.focusedCode).toBe('35');
    expect(next.selectedCode).toBeNull();
  });

  it('replaces the filter set', () => {
    const next = heatMapReducer(base, {
      type: 'setFilters',
      filters: { yearRange: [2020, 2022], categories: ['hirsizlik'] },
    });
    expect(next.filters.yearRange).toEqual([2020, 2022]);
  });

  it('sets the metric and the scale mode', () => {
    expect(heatMapReducer(base, { type: 'setMetric', metric: 'perCapita' }).metric)
      .toBe('perCapita');
    expect(heatMapReducer(base, { type: 'setScaleMode', mode: 'log' }).scaleMode).toBe('log');
  });

  it('resets the view without touching filters', () => {
    const dirty: HeatMapState = {
      ...base,
      transform: { k: 6, x: 3, y: 4 },
      level: 'ilce',
      selectedCode: '3401',
      filters: { yearRange: [2020, 2020], categories: ['x'] },
    };
    const next = heatMapReducer(dirty, { type: 'resetView' });
    expect(next.transform).toEqual({ k: 1, x: 0, y: 0 });
    expect(next.level).toBe('il');
    expect(next.selectedCode).toBeNull();
    expect(next.filters).toBe(dirty.filters);
  });

  it('sets a year range', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2020] });
    expect(next.filters.yearRange).toEqual([2018, 2020]);
  });

  it('normalizes a reversed year range rather than producing an empty selection', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [2020, 2018] });
    expect(next.filters.yearRange).toEqual([2018, 2020]);
  });

  it('clamps a year range to the data bounds', () => {
    const next = heatMapReducer(base, { type: 'setYearRange', range: [1900, 2999] });
    expect(next.filters.yearRange).toEqual(base.yearBounds);
  });

  it('adds a category on first toggle', () => {
    const next = heatMapReducer(base, { type: 'toggleCategory', id: 'hirsizlik' });
    expect(next.filters.categories).toEqual(['hirsizlik']);
  });

  it('removes a category on second toggle', () => {
    const on = heatMapReducer(base, { type: 'toggleCategory', id: 'hirsizlik' });
    const off = heatMapReducer(on, { type: 'toggleCategory', id: 'hirsizlik' });
    expect(off.filters.categories).toEqual([]);
  });

  it('keeps other categories when toggling one', () => {
    let state = heatMapReducer(base, { type: 'toggleCategory', id: 'a' });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'b' });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'a' });
    expect(state.filters.categories).toEqual(['b']);
  });

  it('preserves the year range when toggling a category', () => {
    const ranged = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2019] });
    const toggled = heatMapReducer(ranged, { type: 'toggleCategory', id: 'a' });
    expect(toggled.filters.yearRange).toEqual([2018, 2019]);
  });

  it('restores the defaults on reset without touching the view', () => {
    let state = heatMapReducer(base, { type: 'setYearRange', range: [2018, 2018] });
    state = heatMapReducer(state, { type: 'toggleCategory', id: 'a' });
    state = heatMapReducer(state, { type: 'setTransform', transform: { k: 4, x: -1, y: -2 } });

    const reset = heatMapReducer(state, { type: 'resetFilters' });
    expect(reset.filters).toEqual(base.defaultFilters);
    // Resetting filters is not resetting the map.
    expect(reset.transform).toEqual({ k: 4, x: -1, y: -2 });
  });

  it('returns the same object when reset changes nothing', () => {
    expect(heatMapReducer(base, { type: 'resetFilters' })).toBe(base);
  });

  it('ignores an unknown action rather than throwing', () => {
    expect(heatMapReducer(base, { type: 'nope' } as never)).toBe(base);
  });
});

describe('createHeatMapStore', () => {
  it('notifies subscribers on change', () => {
    const store = createHeatMapStore(base);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'setLevel', level: 'ilce' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when the reducer returns the same state', () => {
    const store = createHeatMapStore(base);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'setLevel', level: 'il' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const store = createHeatMapStore(base);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.dispatch({ type: 'setLevel', level: 'ilce' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('exposes the current state', () => {
    const store = createHeatMapStore(base);
    store.dispatch({ type: 'select', code: '01' });
    expect(store.getState().selectedCode).toBe('01');
  });
});

describe('fly-to requests', () => {
  it('records a requested region', () => {
    const next = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(next.flyToRequest).toBe('34');
  });

  it('clears the request once the map has acted on it', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(heatMapReducer(asked, { type: 'clearFlyTo' }).flyToRequest).toBeNull();
  });

  it('no-ops when clearing an already-empty request', () => {
    expect(heatMapReducer(base, { type: 'clearFlyTo' })).toBe(base);
  });

  it('re-requesting the same region still fires, so a second click flies again', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    const again = heatMapReducer(asked, { type: 'requestFlyTo', code: '34' });
    expect(again).not.toBe(asked);
    expect(again.flyToRequest).toBe('34');
  });

  it('drops a pending request when the level changes, since codes are level-specific', () => {
    const asked = heatMapReducer(base, { type: 'requestFlyTo', code: '34' });
    expect(heatMapReducer(asked, { type: 'setLevel', level: 'ilce' }).flyToRequest).toBeNull();
  });
});

describe('region detail', () => {
  it('opens a detail target at a given level', () => {
    const next = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(next.detail).toEqual({ code: '34', level: 'il' });
  });

  it('selects the region it opened, so the map highlights it', () => {
    const next = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(next.selectedCode).toBe('34');
  });

  it('closes', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(heatMapReducer(open, { type: 'closeDetail' }).detail).toBeNull();
  });

  it('no-ops when closing an already-closed panel', () => {
    expect(heatMapReducer(base, { type: 'closeDetail' })).toBe(base);
  });

  /**
   * The whole reason the target carries its own level. Clicking a province
   * zooms to district level; if that zoom cleared the target, the click would
   * close the panel it just opened.
   */
  it('survives the level change that a province click triggers', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    const zoomed = heatMapReducer(open, { type: 'setLevel', level: 'ilce' });

    expect(zoomed.detail).toEqual({ code: '34', level: 'il' });
    // The selection does not survive — "34" means nothing at district level.
    expect(zoomed.selectedCode).toBeNull();
  });

  it('replaces the target when another region is opened', () => {
    let state = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    state = heatMapReducer(state, { type: 'openDetail', code: '3401', level: 'ilce' });
    expect(state.detail).toEqual({ code: '3401', level: 'ilce' });
  });

  it('closes when the view is reset', () => {
    const open = heatMapReducer(base, { type: 'openDetail', code: '34', level: 'il' });
    expect(heatMapReducer(open, { type: 'resetView' }).detail).toBeNull();
  });
});

describe('requestViewReset', () => {
  const drilled = (): HeatMapState => ({
    ...base,
    transform: { k: 6, x: -800, y: -400 },
    level: 'ilce',
    selectedCode: '34',
    focusedCode: '34',
    detail: { code: '34', level: 'il' },
  });

  it('clears everything the drill-in set', () => {
    const next = heatMapReducer(drilled(), { type: 'requestViewReset' });
    expect(next.detail).toBeNull();
    expect(next.selectedCode).toBeNull();
    expect(next.focusedCode).toBeNull();
    expect(next.flyToRequest).toBeNull();
  });

  it('leaves the transform alone, because only the map can animate it', () => {
    const before = drilled();
    const next = heatMapReducer(before, { type: 'requestViewReset' });
    // `resetView` is the snapping version; this one hands the journey to
    // MapCanvas, which eases the transform home over 600ms.
    expect(next.transform).toBe(before.transform);
  });

  it('counts up, so two consecutive requests are both seen', () => {
    // A boolean would collapse them: the second request would find the flag
    // already set and the map would never hear about it.
    const once = heatMapReducer(base, { type: 'requestViewReset' });
    const twice = heatMapReducer(once, { type: 'requestViewReset' });
    expect(once.viewResetRequest).toBe(base.viewResetRequest + 1);
    expect(twice.viewResetRequest).toBe(once.viewResetRequest + 1);
  });
});
