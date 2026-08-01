import { describe, expect, it, vi } from 'vitest';
import { createHeatMapStore, heatMapReducer, type HeatMapState } from './HeatMapStore.js';

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: { yearRange: [2015, 2024], categories: [] },
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
