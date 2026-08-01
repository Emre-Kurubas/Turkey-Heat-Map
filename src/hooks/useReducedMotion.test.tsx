import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './useReducedMotion.js';

interface FakeQuery {
  matches: boolean;
  listeners: Set<(e: { matches: boolean }) => void>;
}

function installMatchMedia(matches: boolean): FakeQuery {
  const query: FakeQuery = { matches, listeners: new Set() };
  vi.stubGlobal('matchMedia', (q: string) => ({
    media: q,
    get matches() { return query.matches; },
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      query.listeners.add(fn);
    },
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      query.listeners.delete(fn);
    },
  }));
  return query;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('useReducedMotion', () => {
  it('reports false when the user has expressed no preference', () => {
    installMatchMedia(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('reports true when reduced motion is preferred', () => {
    installMatchMedia(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it('reacts when the preference changes mid-session', () => {
    const query = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());

    act(() => {
      query.matches = true;
      for (const fn of query.listeners) fn({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it('assumes reduced motion when matchMedia is unavailable, which is the safe default', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });
});
