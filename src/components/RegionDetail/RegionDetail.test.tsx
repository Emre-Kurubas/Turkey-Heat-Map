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
  detail: { code: '34', level: 'il' },
  metric: 'total',
  scaleMode: 'quantile',
};

function renderDetail(detail: RegionDetailData = DETAIL, onClose = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider
      store={createHeatMapStore(base)}
      hoverStore={createHoverStore()}
      strings={trStrings}
    >
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <RegionDetail detail={detail} categories={CATEGORIES} onClose={onClose} />,
    { wrapper },
  );
  return { ...utils, onClose };
}

describe('RegionDetail', () => {
  it('is a labelled dialog naming the region', () => {
    renderDetail();
    expect(screen.getByRole('dialog', { name: /İstanbul/u })).toBeInTheDocument();
  });

  it('says which administrative level the region is', () => {
    renderDetail();
    expect(screen.getByText(trStrings.detail.levelIl)).toBeInTheDocument();
  });

  it('says İlçe for a district', () => {
    renderDetail({ ...DETAIL, level: 'ilce', code: '3401', name: 'Adalar' });
    expect(screen.getByText(trStrings.detail.levelIlce)).toBeInTheDocument();
  });

  it('shows the region total', () => {
    renderDetail();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('lists every category with its value and share', () => {
    renderDetail();
    expect(screen.getAllByText('Hırsızlık').length).toBeGreaterThan(0);
    expect(screen.getAllByText('160').length).toBeGreaterThan(0);
    expect(screen.getAllByText('%80,0').length).toBeGreaterThan(0);
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
    renderDetail({ ...DETAIL, total: 0, categories: [], byYear: new Map() });
    expect(screen.getByText(trStrings.detail.empty)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: trStrings.pie.title })).not.toBeInTheDocument();
  });

  it('is not modal, so the map behind it stays reachable', () => {
    renderDetail();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
  });
});

