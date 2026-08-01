import { createContext, type ReactNode } from 'react';
import type { Strings } from '@/i18n/index.js';
import type { HeatMapAction, HeatMapState, Store } from './HeatMapStore.js';
import type { HoverAction, HoverState } from './HoverStore.js';

export interface HeatMapContextValue {
  store: Store<HeatMapState, HeatMapAction>;
  hoverStore: Store<HoverState, HoverAction>;
  strings: Strings;
}

/**
 * Null default, checked in the hooks. A component rendered outside the provider
 * is a wiring bug, and failing loudly beats silently reading a fake store.
 */
export const HeatMapContext = createContext<HeatMapContextValue | null>(null);

export interface HeatMapProviderProps extends HeatMapContextValue {
  children: ReactNode;
}

export function HeatMapProvider({ children, ...value }: HeatMapProviderProps) {
  // `value` is rebuilt each render, but its members are stable and every
  // consumer subscribes to a store rather than to context, so this does not
  // cause the re-render storm a naive context value normally would.
  return <HeatMapContext.Provider value={value}>{children}</HeatMapContext.Provider>;
}
