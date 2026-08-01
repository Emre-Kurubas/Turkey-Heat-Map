import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CrimeHeatMap, type CrimeHeatMapProps } from './CrimeHeatMap.js';

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'darp', label: 'Darp' },
  { id: 'gasp', label: 'Gasp' },
];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', ilceCode: '3401', category: 'hirsizlik', count: 100 },
  { year: 2020, ilCode: '06', ilceCode: '0601', category: 'darp', count: 40 },
  { year: 2021, ilCode: '34', ilceCode: '3401', category: 'gasp', count: 70 },
  { year: 2022, ilCode: '06', ilceCode: '0601', category: 'hirsizlik', count: 55 },
];

const VIEWPORT = { width: 800, height: 500 };

function renderMap(props: Partial<CrimeHeatMapProps> = {}) {
  return render(
    <CrimeHeatMap
      data={DATA}
      categories={CATEGORIES}
      testViewport={VIEWPORT}
      {...props}
    />,
  );
}

describe('CrimeHeatMap', () => {
  it('renders the map', () => {
    renderMap();
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('renders the legend', () => {
    renderMap();
    expect(screen.getByRole('group', { name: trStrings.legend.title })).toBeInTheDocument();
  });

  it('always renders the attribution', () => {
    renderMap();
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });

  it('applies string overrides', () => {
    renderMap({ strings: { legend: { title: 'Anahtar' } } });
    expect(screen.getByRole('group', { name: 'Anahtar' })).toBeInTheDocument();
  });

  it('reports reconciliation warnings to the consumer', () => {
    const onDataWarning = vi.fn();
    renderMap({ metric: 'perCapita', onDataWarning });
    expect(onDataWarning).toHaveBeenCalled();
    expect(String(onDataWarning.mock.calls[0]?.[0])).toMatch(/Nüfus/u);
  });

  it('does not warn on clean input', () => {
    const onDataWarning = vi.fn();
    renderMap({ onDataWarning });
    expect(onDataWarning).not.toHaveBeenCalled();
  });

  it('does not mount the legend when that panel is disabled', () => {
    renderMap({ panels: { legend: false } });
    expect(screen.queryByRole('group', { name: trStrings.legend.title })).not.toBeInTheDocument();
  });

  it('still renders the map when every panel is disabled, since the map is the point', () => {
    renderMap({ panels: { legend: false, tooltip: false } });
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('applies theme token overrides to its own root only', () => {
    const { container } = renderMap({ theme: { '--hm-radius': '4px' } });
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--hm-radius'))
      .toBe('4px');
  });

  it('appends a consumer className without dropping its own', () => {
    const { container } = renderMap({ className: 'ozel' });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('hm-root');
    expect(root.className).toContain('ozel');
  });

  it('survives an empty dataset', () => {
    renderMap({ data: [] });
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('shows a Turkish fallback and calls onError when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    // A ramp that throws forces a render failure inside the tree.
    renderMap({
      colorScale: () => { throw new Error('patlama'); },
      onError,
    });
    expect(screen.getByText(trStrings.error.title)).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps a render failure inside its own box rather than unmounting the host', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <div>
        <p>ana sayfa</p>
        <CrimeHeatMap
          data={DATA}
          categories={CATEGORIES}
          testViewport={VIEWPORT}
          colorScale={() => { throw new Error('patlama'); }}
        />
      </div>,
    );
    expect(container.textContent).toContain('ana sayfa');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    spy.mockRestore();
  });
});

const PANEL_QUERIES: Record<string, () => HTMLElement | null> = {
  legend: () => screen.queryByRole('group', { name: trStrings.legend.title }),
  sidebar: () => screen.queryByRole('group', { name: trStrings.sidebar.title }),
  search: () => screen.queryByRole('combobox', { name: trStrings.search.label }),
  filters: () => screen.queryByRole('group', { name: trStrings.filters.title }),
  pie: () => screen.queryByRole('group', { name: trStrings.pie.title }),
  trend: () => screen.queryByRole('group', { name: trStrings.trend.title }),
};

const ALL_OFF = {
  legend: false, tooltip: false, sidebar: false,
  search: false, filters: false, pie: false, trend: false,
};

describe('CrimeHeatMap — panel matrix', () => {
  it('mounts every panel by default', () => {
    renderMap();
    for (const [name, query] of Object.entries(PANEL_QUERIES)) {
      expect(query(), name).toBeInTheDocument();
    }
  });

  it.each(Object.keys(PANEL_QUERIES))('mounts no DOM at all for a disabled %s', (name) => {
    renderMap({ panels: { [name]: false } });
    expect(PANEL_QUERIES[name]!()).not.toBeInTheDocument();
  });

  it.each(Object.keys(PANEL_QUERIES))(
    'leaves the other panels mounted when %s is off',
    (name) => {
      renderMap({ panels: { [name]: false } });
      for (const [other, query] of Object.entries(PANEL_QUERIES)) {
        if (other !== name) expect(query(), other).toBeInTheDocument();
      }
    },
  );

  it('still renders the map with every panel disabled', () => {
    renderMap({ panels: ALL_OFF });
    expect(screen.getByRole('application', { name: trStrings.map.label })).toBeInTheDocument();
  });

  it('keeps the attribution even with every panel disabled, since the licence requires it', () => {
    renderMap({ panels: ALL_OFF });
    expect(screen.getByText(/OpenStreetMap/u)).toBeInTheDocument();
  });
});
