import { useEffect, useSyncExternalStore } from 'react';
import type { GeoLevel } from '@/core/types/index.js';
import { isLevelLoaded, loadLevelFeatures, subscribeLevels } from '@/data/geo/index.js';

/**
 * Whether a level's geometry can be drawn, requesting it if it cannot.
 *
 * District geometry is a separate chunk, so "can we draw districts" is a
 * question with a changing answer — and three places need the same answer at the
 * same time. The aggregation level decides whether totals are keyed by district
 * or by province, the zoom level decides which boundaries are outlined, and the
 * projection decides which features exist; if any of them says districts while
 * another says provinces, the map paints district totals onto province shapes
 * and every region reads as no-data.
 *
 * `useSyncExternalStore` over module state is what keeps them in step. React
 * state in one hook could not be read by the others without threading it
 * through every call site between them.
 *
 * The request goes out on mount rather than on first zoom. Waiting until the
 * reader crosses the threshold would put a visible pause at exactly the moment
 * they asked for detail; fetching immediately costs nothing, because it is off
 * the critical path for the first paint.
 */
export function useLoadedLevel(level: GeoLevel): boolean {
  const loaded = useSyncExternalStore(
    subscribeLevels,
    () => isLevelLoaded(level),
    () => isLevelLoaded(level),
  );

  useEffect(() => {
    if (loaded) return;
    void loadLevelFeatures(level);
  }, [level, loaded]);

  return loaded;
}
