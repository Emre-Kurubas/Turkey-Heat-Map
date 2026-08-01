import { useCallback, useContext, useSyncExternalStore } from 'react';
import { HeatMapContext, type HeatMapContextValue } from '@/context/HeatMapProvider.js';
import type { HeatMapAction, HeatMapState } from '@/context/HeatMapStore.js';
import type { Strings } from '@/i18n/index.js';

function useHeatMapContext(): HeatMapContextValue {
  const ctx = useContext(HeatMapContext);
  if (ctx === null) {
    throw new Error('[heatmap] Bu bileşen <CrimeHeatMap> içinde kullanılmalı.');
  }
  return ctx;
}

/**
 * Subscribes to one slice of state.
 *
 * The selector's result is compared by `Object.is`, so a selector that builds a
 * new object each call re-renders every time. Select primitives, or memoize the
 * derived object outside the hook.
 */
export function useHeatMapState<T>(selector: (state: HeatMapState) => T): T {
  const { store } = useHeatMapContext();
  const getSnapshot = useCallback(() => selector(store.getState()), [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useHeatMapDispatch(): (action: HeatMapAction) => void {
  return useHeatMapContext().store.dispatch;
}

export function useStrings(): Strings {
  return useHeatMapContext().strings;
}
