import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { CrimeCategory } from '@/core/types/index.js';
import type { RegionDetailData } from '@/hooks/useRegionDetail.js';
import { trStrings } from '@/i18n/index.js';
import { RegionDetail } from './RegionDetail.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'a', label: 'Hırsızlık' },
  { id: 'b', label: 'Darp' },
];

const DETAIL: RegionDetailData = {
  code: '34',
  level: 'il',
  name: 'İstanbul',
  total: 200,
  categories: [
    { id: 'a', label: 'Hırsızlık', value: 160, share: 0.8 },
    { id: 'b', label: 'Darp', value: 40, share: 0.2 },
  ],
  byYear: new Map([[2020, 100], [2021, 100]]),
  children: [
    { code: '3401', name: 'Adalar', total: 120, share: 0.6, rank: 1 },
    { code: '3402', name: 'Besiktas', total: 80, share: 0.4, rank: 2 },
  ],
};

/** The same panel opened one level down: no children, categories instead. */
const DISTRICT: RegionDetailData = {
  ...DETAIL, level: 'ilce', code: '3401', name: 'Adalar', children: [],
};

const DEFAULTS = { yearRange: [2020, 2021] as [number, number], categories: [] };

const base: HeatMapState = {
  level: 'il',
  transform: { k: 1, x: 0, y: 0 },
  focusedCode: null,
  selectedCode: '34',
  filters: DEFAULTS,
  defaultFilters: DEFAULTS,
  yearBounds: [2020, 2021],
  flyToRequest: null,
  viewResetRequest: 0,
  detail: { code: '34', level: 'il' },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderDetail(detail: RegionDetailData = DETAIL, onClose = vi.fn()) {
  const store = createHeatMapStore(base);
  const hoverStore = createHoverStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <RegionDetail detail={detail} categories={CATEGORIES} onClose={onClose} />,
    { wrapper },
  );
  return { ...utils, onClose, store, hoverStore };
}

describe('RegionDetail', () => {
  it('is a labelled dialog naming the region', () => {
    renderDetail();
    expect(screen.getByRole('dialog', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('names the region and nothing beside it', () => {
    // The level pill is gone: a province lists its districts and a district
    // lists its categories, which says the same thing without the chrome.
    renderDetail();
    expect(screen.getByRole('heading', { name: 'İstanbul' })).toBeInTheDocument();
  });

  it('states the region total beside its name, as the rail states the country', () => {
    const { container } = renderDetail();
    const total = container.querySelector('[data-role="scope-total"]');
    expect(total?.textContent).toContain('200');
    // Visually the number sits next to a place name on a crime map and needs no
    // introduction; read aloud on its own it would be a bare figure.
    expect(total?.textContent).toContain(trStrings.detail.total);
  });

  it('lists every category with its count, for a district', () => {
    renderDetail(DISTRICT);
    expect(screen.getAllByText('Hırsızlık').length).toBeGreaterThan(0);
    expect(screen.getAllByText('160').length).toBeGreaterThan(0);
  });

  it('writes no share beside the count, since the donut is the share', () => {
    // The 42px that column took were coming out of the label, and half a
    // category name next to an exact percentage is the wrong trade.
    const { container } = renderDetail(DISTRICT);
    const table = container.querySelector('[data-role="category-table"]')!;
    expect(table.textContent).not.toContain('%');
  });

  it('renders the donut', () => {
    renderDetail();
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
  });

  it('renders the yearly chart', () => {
    renderDetail();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });

  it('closes on the close button', () => {
    const { onClose } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: trStrings.detail.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape, so the keyboard can dismiss it', () => {
    const { onClose } = renderDetail();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const { onClose } = renderDetail();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says so for a region with no records rather than rendering empty charts', () => {
    renderDetail({ ...DETAIL, total: 0, categories: [], byYear: new Map(), children: [] });
    expect(screen.getByText(trStrings.detail.empty)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: trStrings.pie.title })).not.toBeInTheDocument();
  });

  it('is not modal, so the map behind it stays reachable', () => {
    renderDetail();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
  });
});

describe('RegionDetail — a province drills down to its districts', () => {
  it('lists the districts inside it, biggest first', () => {
    const { container } = renderDetail();
    const rows = [...container.querySelectorAll('[data-role="child-row"]')]
      .map((row) => row.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Adalar');
    expect(rows[1]).toContain('Besiktas');
  });

  it('shows each district count and its share of the province', () => {
    const { container } = renderDetail();
    const first = container.querySelector('[data-role="child-row"]')!;
    expect(first.textContent).toContain('120');
    expect(first.textContent).toContain('%60,0');
  });

  it('numbers the districts by position', () => {
    const { container } = renderDetail();
    expect(container.querySelector('[data-role="child-row"]')?.textContent).toMatch(/^1/u);
  });

  it('shows districts in place of the category table', () => {
    // At province level the donut beside them carries the categories.
    const { container } = renderDetail();
    expect(container.querySelector('[data-role="category-table"]')).toBeNull();
    expect(screen.getByText(trStrings.detail.districts)).toBeInTheDocument();
  });

  it('gives the donut its key, since nothing else lists the categories', () => {
    renderDetail();
    const pie = screen.getByRole('group', { name: trStrings.pie.title });
    expect(pie.querySelector('ul')).not.toBeNull();
  });

  it('caps the list rather than printing all thirty-nine districts', () => {
    const many = Array.from({ length: 39 }, (_, i) => ({
      code: `34${String(i).padStart(2, '0')}`,
      name: `İlçe ${i}`,
      total: 39 - i,
      share: 1 / 39,
      rank: i + 1,
    }));
    const { container } = renderDetail({ ...DETAIL, children: many });
    expect(container.querySelectorAll('[data-role="child-row"]')).toHaveLength(10);
  });

  it('opens a district panel when one of its rows is clicked', () => {
    const { container, store } = renderDetail();
    fireEvent.click(container.querySelector('[data-role="child-row"][data-code="3401"]')!);
    expect(store.getState().detail).toEqual({ code: '3401', level: 'ilce' });
  });

  it('flies to the district it opened', () => {
    const { container, store } = renderDetail();
    fireEvent.click(container.querySelector('[data-role="child-row"][data-code="3402"]')!);
    expect(store.getState().flyToRequest).toBe('3402');
  });

  it('highlights the district on the map while a row is hovered', () => {
    const { container, hoverStore } = renderDetail();
    fireEvent.pointerEnter(container.querySelector('[data-role="child-row"]')!);
    expect(hoverStore.getState()).toEqual({ code: '3401', x: 0, y: 0, source: 'list' });
  });

  it('says so when a province has no district records at all', () => {
    renderDetail({ ...DETAIL, children: [] });
    expect(screen.getByText(trStrings.detail.noChildren)).toBeInTheDocument();
  });
});

describe('RegionDetail — a district has nothing below it', () => {
  it('shows the category table in place of a district list', () => {
    const { container } = renderDetail(DISTRICT);
    expect(container.querySelectorAll('[data-role="child-row"]')).toHaveLength(0);
    expect(container.querySelector('[data-role="category-table"]')).not.toBeNull();
  });

  it('drops the donut key, which would repeat that table', () => {
    renderDetail(DISTRICT);
    const pie = screen.getByRole('group', { name: trStrings.pie.title });
    expect(pie.querySelector('ul')).toBeNull();
  });

  it('still carries both charts', () => {
    renderDetail(DISTRICT);
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });
});

describe('RegionDetail — one shape for every region', () => {
  /**
   * The panel is a fixed height, and it gets there by fitting contents that
   * never change size. Each of these was a way the contents changed size.
   */
  it('writes the category heading once, not once per element that could carry it', () => {
    // The section heading and the table caption were the same three words, one
    // under the other. The trend chart's own hidden table is excluded — it
    // carries a caption too, and that one is not on the page.
    const { container } = renderDetail(DISTRICT);
    const visible = [...container.querySelectorAll('h3, caption')]
      .filter((node) => node.closest('.hm-visually-hidden') === null)
      .filter((node) => !node.className.includes('visually-hidden'))
      .map((node) => node.textContent);
    expect(visible).toEqual([trStrings.detail.categories]);
  });

  it('keeps the table named for a screen reader all the same', () => {
    const { container } = renderDetail(DISTRICT);
    const caption = container.querySelector('[data-role="category-table"] caption');
    expect(caption?.textContent).toBe(trStrings.detail.categories);
    expect(caption?.className).toContain('visually-hidden');
  });

  it('reserves the list band whether it draws two rows or ten', () => {
    const { container } = renderDetail({ ...DETAIL, children: DETAIL.children.slice(0, 1) });
    expect(container.querySelector('[class*="listBand"]')).not.toBeNull();
  });
});

describe('RegionDetail — a district pairs its donut with its table', () => {
  it('puts them in one band, with no rule between', () => {
    // They are the same cut of the same numbers: the donut is the shape of the
    // table, the table is the numbers behind the donut. A line between them
    // would be separating a drawing from its own key.
    const { container } = renderDetail(DISTRICT);
    const pairing = container.querySelector('[data-role="category-pairing"]');
    expect(pairing).not.toBeNull();
    expect(pairing?.querySelector('[data-role="category-table"]')).not.toBeNull();
    expect(pairing?.querySelector('[data-role="pie-body"]')).not.toBeNull();
  });

  it('draws the donut first, so it lands on the left', () => {
    const { container } = renderDetail(DISTRICT);
    const pairing = container.querySelector('[data-role="category-pairing"]')!;
    const first = pairing.firstElementChild;
    expect(first?.querySelector('[data-role="pie-body"]')).not.toBeNull();
    expect(first?.querySelector('[data-role="category-table"]')).toBeNull();
  });

  it('shows one donut, not the paired one and a second underneath', () => {
    const { container } = renderDetail(DISTRICT);
    expect(container.querySelectorAll('[data-role="pie-body"]')).toHaveLength(1);
  });

  it('leaves the donut keyless, since the table beside it is the key', () => {
    // And a better one: the table lists every category rather than folding the
    // small ones into "Diğer".
    renderDetail(DISTRICT);
    expect(screen.getByRole('group', { name: trStrings.pie.title }).querySelector('ul'))
      .toBeNull();
  });

  it('keeps a province on three bands, its list and its donut apart', () => {
    // There they are different cuts — districts below it, categories across it.
    const { container } = renderDetail();
    expect(container.querySelector('[data-role="category-pairing"]')).toBeNull();
    expect(container.querySelectorAll('[class*="band"]')).toHaveLength(3);
  });
});
