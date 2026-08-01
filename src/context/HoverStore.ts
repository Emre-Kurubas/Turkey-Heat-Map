import type { Store } from './HeatMapStore.js';

export interface HoverTarget {
  code: string;
  /** Client coordinates, for tooltip placement. */
  x: number;
  y: number;
}

export type HoverAction =
  | { type: 'enter'; target: HoverTarget }
  | { type: 'move'; x: number; y: number }
  | { type: 'leave' };

export type HoverState = HoverTarget | null;

export function hoverReducer(state: HoverState, action: HoverAction): HoverState {
  switch (action.type) {
    case 'enter':
      return action.target;
    case 'move':
      // Moving with nothing hovered is a no-op, not an error: pointermove fires
      // over the gaps between regions too.
      if (state === null) return state;
      if (state.x === action.x && state.y === action.y) return state;
      return { ...state, x: action.x, y: action.y };
    case 'leave':
      return state === null ? state : null;
    default:
      return state;
  }
}

/**
 * Hover lives in its own store so pointer movement repaints the tooltip alone.
 * Folding it into the main store would re-render every subscribed panel on
 * every pointermove — the difference between the map feeling instant and
 * feeling sluggish (§7.2).
 */
export function createHoverStore(): Store<HoverState, HoverAction> {
  let state: HoverState = null;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch(action) {
      const next = hoverReducer(state, action);
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
