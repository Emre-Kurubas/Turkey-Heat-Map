import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isLevelLoaded, peekLevelFeatures } from '@/data/geo/index.js';
import { useLoadedLevel } from './useLoadedLevel.js';

/**
 * The signal that keeps three hooks in step.
 *
 * District geometry is a separate chunk, so "can we draw districts" is a
 * question whose answer changes after mount — and the aggregation level, the
 * zoom level and the projected geometry all have to agree about it. If any of
 * them says districts while another says provinces, the map keys totals by
 * district and paints them onto province shapes, and the whole country reads as
 * no-data.
 */
describe('useLoadedLevel', () => {
  it('reports provinces as drawable immediately', () => {
    // They are static: the projection is fitted to them, so nothing renders
    // without them and there is nothing to wait for.
    const { result } = renderHook(() => useLoadedLevel('il'));
    expect(result.current).toBe(true);
  });

  /*
   * First in the file to touch districts, and it has to stay that way: the
   * module cache is shared across a test file, so once anything here has loaded
   * them there is no unloaded state left to observe.
   */
  it('reports districts as not drawable at first, then as drawable', async () => {
    expect(isLevelLoaded('ilce')).toBe(false);

    // Mounting is the whole trigger — no zoom, no threshold crossed. Waiting
    // for the reader to ask would put a visible pause at exactly the moment
    // they asked for detail.
    const { result } = renderHook(() => useLoadedLevel('ilce'));
    expect(result.current).toBe(false);

    await waitFor(() => { expect(result.current).toBe(true); });
    expect(isLevelLoaded('ilce')).toBe(true);
  });

  it('leaves the geometry in place for the next reader', async () => {
    const { result, unmount } = renderHook(() => useLoadedLevel('ilce'));
    await waitFor(() => { expect(result.current).toBe(true); });
    unmount();
    expect(peekLevelFeatures('ilce')?.features).toHaveLength(973);
  });

  it('serves several consumers from one load', async () => {
    // Every hook subscribes to the same module state, so two components asking
    // at once cannot end up with different answers.
    const a = renderHook(() => useLoadedLevel('ilce'));
    const b = renderHook(() => useLoadedLevel('ilce'));

    await waitFor(() => { expect(a.result.current).toBe(true); });
    expect(b.result.current).toBe(true);
  });
});
