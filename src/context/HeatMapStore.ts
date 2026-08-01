import type {
  FilterSet, GeoLevel, MetricMode, ScaleMode, Transform,
} from '@/core/types/index.js';

export interface HeatMapState {
  level: GeoLevel;
  transform: Transform;
  /** Keyboard focus target. Separate from selection (§10). */
  focusedCode: string | null;
  selectedCode: string | null;
  filters: FilterSet;
  metric: MetricMode;
  scaleMode: ScaleMode;
}

export type HeatMapAction =
  | { type: 'setTransform'; transform: Transform }
  | { type: 'setLevel'; level: GeoLevel }
  | { type: 'select'; code: string | null }
  | { type: 'focus'; code: string | null }
  | { type: 'setFilters'; filters: FilterSet }
  | { type: 'setMetric'; metric: MetricMode }
  | { type: 'setScaleMode'; mode: ScaleMode }
  | { type: 'resetView' };

export const IDENTITY_TRANSFORM: Transform = { k: 1, x: 0, y: 0 };

export function heatMapReducer(state: HeatMapState, action: HeatMapAction): HeatMapState {
  switch (action.type) {
    case 'setTransform':
      return { ...state, transform: action.transform };

    case 'setLevel':
      if (action.level === state.level) return state;
      // Region codes are level-specific: "34" means İstanbul at il level and
      // nothing at all at ilçe level. Carrying a selection across would
      // highlight a region that does not exist.
      return { ...state, level: action.level, selectedCode: null, focusedCode: null };

    case 'select':
      return { ...state, selectedCode: action.code };

    case 'focus':
      return { ...state, focusedCode: action.code };

    case 'setFilters':
      return { ...state, filters: action.filters };

    case 'setMetric':
      return { ...state, metric: action.metric };

    case 'setScaleMode':
      return { ...state, scaleMode: action.mode };

    case 'resetView':
      return {
        ...state,
        transform: IDENTITY_TRANSFORM,
        level: 'il',
        selectedCode: null,
        focusedCode: null,
      };

    default:
      return state;
  }
}

/**
 * Members are declared as function-typed properties rather than methods on
 * purpose. `useSyncExternalStore` takes `store.subscribe` and `store.getState`
 * detached from the object, and method syntax would let a `this`-dependent
 * implementation typecheck while breaking at runtime. These are closures; the
 * type now says so.
 */
export interface Store<S, A> {
  getState: () => S;
  dispatch: (action: A) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A minimal external store for `useSyncExternalStore`.
 *
 * Hand-rolled rather than `useReducer` + context: context re-renders every
 * consumer on any change, and this component has panels that must not repaint
 * when an unrelated slice moves. Subscribers are notified only when the reducer
 * actually returns a new object, so a no-op dispatch is free.
 */
export function createHeatMapStore(
  initial: HeatMapState,
): Store<HeatMapState, HeatMapAction> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch(action) {
      const next = heatMapReducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
