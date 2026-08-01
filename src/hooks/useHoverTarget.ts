import { useContext, useSyncExternalStore } from 'react';
import { HeatMapContext } from '@/context/HeatMapProvider.js';
import type { Store } from '@/context/HeatMapStore.js';
import type { HoverAction, HoverState } from '@/context/HoverStore.js';

function useHoverStore(): Store<HoverState, HoverAction> {
  const ctx = useContext(HeatMapContext);
  if (ctx === null) {
    throw new Error('[heatmap] Bu bileşen <CrimeHeatMap> içinde kullanılmalı.');
  }
  return ctx.hoverStore;
}

/** The currently hovered region, or null. Re-renders only its caller. */
export function useHoverTarget(): HoverState {
  const store = useHoverStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSetHoverTarget(): (action: HoverAction) => void {
  return useHoverStore().dispatch;
}
