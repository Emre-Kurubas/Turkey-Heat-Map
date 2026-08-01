import { describe, expect, it, vi } from 'vitest';
import { createHoverStore, hoverReducer, type HoverTarget } from './HoverStore.js';

const OVER_MAP: HoverTarget = { code: '34', x: 120, y: 80, source: 'map' };
const FROM_LIST: HoverTarget = { code: '06', x: 0, y: 0, source: 'list' };

describe('hoverReducer', () => {
  it('takes the target on enter', () => {
    expect(hoverReducer(null, { type: 'enter', target: OVER_MAP })).toEqual(OVER_MAP);
  });

  it('replaces one region with the next without passing through null', () => {
    // Crossing a border fires leave-then-enter in some browsers and only enter
    // in others; the reducer has to survive either.
    const next = hoverReducer(OVER_MAP, { type: 'enter', target: FROM_LIST });
    expect(next).toEqual(FROM_LIST);
  });

  it('carries the source through, since it decides whether a tooltip opens', () => {
    // A list hover highlights the region but must not open a tooltip: there is
    // no pointer over the map to anchor one to.
    const next = hoverReducer(null, { type: 'enter', target: FROM_LIST });
    expect(next?.source).toBe('list');
  });

  it('moves the pointer without forgetting which region it is over', () => {
    const next = hoverReducer(OVER_MAP, { type: 'move', x: 200, y: 150 });
    expect(next).toEqual({ code: '34', x: 200, y: 150, source: 'map' });
  });

  it('clears on leave', () => {
    expect(hoverReducer(OVER_MAP, { type: 'leave' })).toBeNull();
  });

  it('ignores an action it does not know', () => {
    const unknown = { type: 'nope' } as unknown as Parameters<typeof hoverReducer>[1];
    expect(hoverReducer(OVER_MAP, unknown)).toBe(OVER_MAP);
  });
});

/**
 * Identity is the contract, not an implementation detail.
 *
 * The store skips notifying subscribers whenever the reducer hands back the
 * state it was given, so every case below that returns the *same reference* is
 * a case where the tooltip does not repaint. That is the entire reason hover
 * lives in its own store: pointermove fires continuously, and folding it
 * into the main store would re-render every subscribed panel on every frame of
 * a mouse drag across the map.
 */
describe('hoverReducer — when nothing should change, nothing does', () => {
  it('returns the same state for a move with nothing hovered', () => {
    // pointermove fires over the gaps between regions too.
    expect(hoverReducer(null, { type: 'move', x: 10, y: 10 })).toBeNull();
  });

  it('returns the same object for a move that did not move', () => {
    // The common case during a slow drag: several events land on one pixel.
    const same = hoverReducer(OVER_MAP, { type: 'move', x: OVER_MAP.x, y: OVER_MAP.y });
    expect(same).toBe(OVER_MAP);
  });

  it('returns a new object only when a coordinate actually changes', () => {
    expect(hoverReducer(OVER_MAP, { type: 'move', x: OVER_MAP.x, y: 81 }))
      .not.toBe(OVER_MAP);
  });

  it('returns the same state for a leave with nothing hovered', () => {
    expect(hoverReducer(null, { type: 'leave' })).toBeNull();
  });
});

describe('createHoverStore', () => {
  it('starts with nothing hovered', () => {
    expect(createHoverStore().getState()).toBeNull();
  });

  it('applies a dispatch to the state', () => {
    const store = createHoverStore();
    store.dispatch({ type: 'enter', target: OVER_MAP });
    expect(store.getState()).toEqual(OVER_MAP);
  });

  it('notifies subscribers when the state changes', () => {
    const store = createHoverStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: 'enter', target: OVER_MAP });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the reducer changes nothing', () => {
    // The point of the identity guard above, seen from the outside: a drag that
    // does not leave the pixel it started on repaints nothing.
    const store = createHoverStore();
    store.dispatch({ type: 'enter', target: OVER_MAP });

    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'move', x: OVER_MAP.x, y: OVER_MAP.y });
    store.dispatch({ type: 'leave' });
    store.dispatch({ type: 'leave' });

    // One notification: the first leave. The repeat and the still move are free.
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies every subscriber', () => {
    const store = createHoverStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);

    store.dispatch({ type: 'enter', target: OVER_MAP });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops notifying once unsubscribed', () => {
    const store = createHoverStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.dispatch({ type: 'enter', target: OVER_MAP });
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps two stores independent, so two maps on a page do not share a hover', () => {
    const a = createHoverStore();
    const b = createHoverStore();

    a.dispatch({ type: 'enter', target: OVER_MAP });
    expect(b.getState()).toBeNull();
  });

  /**
   * The reason `Store` declares its members as function-typed properties rather
   * than as methods. `useSyncExternalStore` is handed `store.subscribe` and
   * `store.getState` detached from the object, and a `this`-dependent
   * implementation would typecheck and then break at runtime.
   */
  it('survives having its members pulled off the object', () => {
    const store = createHoverStore();
    const { getState, dispatch, subscribe } = store;
    const listener = vi.fn();

    subscribe(listener);
    dispatch({ type: 'enter', target: FROM_LIST });

    expect(getState()).toEqual(FROM_LIST);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
