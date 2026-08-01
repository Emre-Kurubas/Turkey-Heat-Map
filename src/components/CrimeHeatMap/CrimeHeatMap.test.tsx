import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CrimeCategory, CrimeRecord } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { CrimeHeatMap, type CrimeHeatMapProps } from './CrimeHeatMap.js';

const CATEGORIES: CrimeCategory[] = [{ id: 'hirsizlik', label: 'Hırsızlık' }];
const DATA: CrimeRecord[] = [
  { year: 2020, ilCode: '34', category: 'hirsizlik', count: 100 },
  { year: 2021, ilCode: '06', category: 'hirsizlik', count: 40 },
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
