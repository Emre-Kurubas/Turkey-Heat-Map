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
  /** What `resetFilters` restores. Set once from the reconciled props. */
  defaultFilters: FilterSet;
  /** The data's full year span. The slider's extent, and the range clamp. */
  yearBounds: [number, number];
  /**
   * A region the map has been asked to fly to, by a panel that cannot reach
   * the map directly. The map clears it once the animation starts.
   */
  flyToRequest: string | null;
  metric: MetricMode;
  scaleMode: ScaleMode;
}

export type HeatMapAction =
  | { type: 'setTransform'; transform: Transform }
  | { type: 'setLevel'; level: GeoLevel }
  | { type: 'select'; code: string | null }
  | { type: 'focus'; code: string | null }
  | { type: 'setFilters'; filters: FilterSet }
  | { type: 'setYearRange'; range: [number, number] }
  | { type: 'toggleCategory'; id: string }
  | { type: 'resetFilters' }
  | { type: 'setMetric'; metric: MetricMode }
  | { type: 'setScaleMode'; mode: ScaleMode }
  | { type: 'requestFlyTo'; code: string }
  | { type: 'clearFlyTo' }
  | { type: 'resetView' };

export const IDENTITY_TRANSFORM: Transform = { k: 1, x: 0, y: 0 };

export function heatMapReducer(state: HeatMapState, action: HeatMapAction): HeatMapState {
  switch (action.type) {
    case 'setTransform':
      return { ...state, transform: action.transform };

    case 'setLevel':
      if (action.level === state.level) return state;
      // Region codes are level-specific: "34" means İstanbul at il level and
      // nothing at all at ilçe level. Carrying a selection — or a pending
      // fly-to — across would target a region that does not exist.
      return {
        ...state,
        level: action.level,
        selectedCode: null,
        focusedCode: null,
        flyToRequest: null,
      };

    case 'select':
      return { ...state, selectedCode: action.code };

    case 'focus':
      return { ...state, focusedCode: action.code };

    case 'setFilters':
      return { ...state, filters: action.filters };

    case 'setYearRange': {
      // Normalize rather than trusting the caller: a dual-handle slider can
      // drag its low handle past its high one, and an inverted range would
      // silently select nothing.
      const [lo, hi] = action.range;
      const [minYear, maxYear] = state.yearBounds;
      const start = Math.max(minYear, Math.min(lo, hi));
      const end = Math.min(maxYear, Math.max(lo, hi));
      return { ...state, filters: { ...state.filters, yearRange: [start, end] } };
    }

    case 'toggleCategory': {
      const current = state.filters.categories;
      const next = current.includes(action.id)
        ? current.filter((id) => id !== action.id)
        : [...current, action.id];
      return { ...state, filters: { ...state.filters, categories: next } };
    }

    case 'resetFilters':
      return state.filters === state.defaultFilters
        ? state
        : { ...state, filters: state.defaultFilters };

    case 'setMetric':
      return { ...state, metric: action.metric };

    case 'setScaleMode':
      return { ...state, scaleMode: action.mode };

    case 'requestFlyTo':
      // Always a new object, even for the same code: clicking the same sidebar
      // row twice should fly twice, and identity is how the map notices.
      return { ...state, flyToRequest: action.code };

    case 'clearFlyTo':
      return state.flyToRequest === null ? state : { ...state, flyToRequest: null };

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
