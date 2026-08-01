import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CrimeCategory } from '@/core/types/index.js';
import { useSearchIndex } from './useSearchIndex.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const YEARS = [2020, 2021];

describe('useSearchIndex', () => {
  it('indexes every province', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'il')).toHaveLength(81);
  });

  it('indexes every district', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'ilce')).toHaveLength(973);
  });

  it('indexes the categories and years given to it', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    expect(result.current.filter((e) => e.type === 'category')).toHaveLength(1);
    expect(result.current.filter((e) => e.type === 'year')).toHaveLength(2);
  });

  it('names the parent province of each district, so duplicates are tellable apart', () => {
    const { result } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    const adalar = result.current.find((e) => e.type === 'ilce' && e.id === '3401');
    expect(adalar?.parentLabel).toBe('İstanbul');
  });

  it('is stable across renders with the same inputs', () => {
    const { result, rerender } = renderHook(() => useSearchIndex(CATEGORIES, YEARS));
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });
});
