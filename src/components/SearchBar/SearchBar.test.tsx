import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { SearchBar } from './SearchBar.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];

const DEFAULTS = { yearRange: [2015, 2024] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: null,
  filters: DEFAULTS,
  defaultFilters: DEFAULTS,
  yearBounds: [2015, 2024],
  flyToRequest: null,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

function renderSearch(state: HeatMapState = base) {
  const store = createHeatMapStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={createHoverStore()} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(<SearchBar categories={CATEGORIES} />, { wrapper });
  const input = screen.getByRole('combobox');
  return { ...utils, store, input };
}

describe('SearchBar', () => {
  it('renders a labelled combobox', () => {
    renderSearch();
    expect(screen.getByRole('combobox', { name: trStrings.search.label })).toBeInTheDocument();
  });

  it('shows no dropdown until something is typed', () => {
    renderSearch();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  /** The İ/I trap: naive toLowerCase breaks this pair. */
  it('finds İstanbul from an undotted, unaccented query', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'istanbul' } });
    expect(screen.getByRole('option', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('finds Şişli from "sisli"', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'sisli' } });
    expect(screen.getByRole('option', { name: /Şişli/u })).toBeInTheDocument();
  });

  it('finds Ağrı from "agri"', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'agri' } });
    expect(screen.getByRole('option', { name: /Ağrı/u })).toBeInTheDocument();
  });

  it('groups results by entity type', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: '2020' } });
    expect(screen.getByText(trStrings.search.groups.year)).toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'zzzzqqq' } });
    expect(screen.getByText(trStrings.search.noResults)).toBeInTheDocument();
  });

  it('requests a fly-to when a province is chosen', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Ankara' }));
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('applies a category as a filter rather than flying anywhere', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'hirsizlik' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Hırsızlık/u }));
    expect(store.getState().filters.categories).toEqual(['hirsizlik']);
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('applies a year as a single-year range', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: '2020' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: '2020' }));
    expect(store.getState().filters.yearRange).toEqual([2020, 2020]);
  });

  it('moves the active option with the arrow keys', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'an' } });

    const first = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first);
  });

  it('does not move past the last option', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-0$/u);
  });

  it('selects the active option on Enter', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('closes the dropdown on Escape without clearing the query', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('ankara');
  });

  it('clears the query after a selection, so the dropdown does not linger', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect((input as HTMLInputElement).value).toBe('');
    expect(store.getState().flyToRequest).toBe('06');
  });

  it('does nothing on Enter with no results', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'zzzzqqq' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('ignores an unhandled key', () => {
    const { input, store } = renderSearch();
    fireEvent.change(input, { target: { value: 'ankara' } });
    fireEvent.keyDown(input, { key: 'q' });
    expect(store.getState().flyToRequest).toBeNull();
  });

  it('shows the parent province beside a district, since names repeat', () => {
    const { input } = renderSearch();
    fireEvent.change(input, { target: { value: 'yenisehir' } });
    // Yenişehir occurs three times; the parent is what tells them apart.
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    expect(screen.getAllByRole('option')[0]?.textContent).toMatch(/·/u);
  });
});
