import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore, type HeatMapState } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import { createColorScale } from '@/core/color/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { trStrings } from '@/i18n/index.js';
import { Sidebar, type SidebarSections } from './Sidebar.js';

const ROWS: RankedRegion[] = [
  { code: '34', name: 'İstanbul', total: 900, share: 0.6, rank: 1 },
  { code: '06', name: 'Ankara', total: 400, share: 0.27, rank: 2 },
  { code: '35', name: 'İzmir', total: 200, share: 0.13, rank: 3 },
];
const SCALE = createColorScale({ values: [900, 400, 200], mode: 'quantile', ramp: 'spectral' });

const CATEGORIES: CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'gasp', label: 'Gasp' },
];
const CATEGORY_TOTALS = new Map([['hirsizlik', 900], ['gasp', 600]]);
const BY_YEAR = new Map([[2019, 700], [2020, 800]]);

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
  viewResetRequest: 0,
  detail: null,
  metric: 'total',
  scaleMode: 'quantile',
};

const ALL: SidebarSections = { pie: true, trend: true, list: true };

function renderSidebar(
  rows: RankedRegion[] = ROWS,
  state: HeatMapState = base,
  sections: SidebarSections = ALL,
) {
  const store = createHeatMapStore(state);
  const hoverStore = createHoverStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HeatMapProvider store={store} hoverStore={hoverStore} strings={trStrings}>
      {children}
    </HeatMapProvider>
  );
  const utils = render(
    <Sidebar
      rows={rows}
      scale={SCALE}
      categories={CATEGORIES}
      categoryTotals={CATEGORY_TOTALS}
      byYear={BY_YEAR}
      total={1500}
      regionName={null}
      onHoverCategory={() => {}}
      sections={sections}
    />,
    { wrapper },
  );
  return { ...utils, store, hoverStore };
}

/** A ranked list long enough to exercise the top-N cut. */
function manyRows(count: number): RankedRegion[] {
  return Array.from({ length: count }, (_, i) => ({
    code: String(i).padStart(4, '0'),
    name: `Bölge ${String(i).padStart(3, '0')}`,
    total: count - i,
    share: 1 / count,
    rank: i + 1,
  }));
}

describe('Sidebar', () => {
  it('is labelled as a group', () => {
    renderSidebar();
    expect(screen.getByRole('group', { name: trStrings.sidebar.title })).toBeInTheDocument();
  });

  it('renders a row per region with name, count and share', () => {
    // Scoped to the row: the donut's legend beside it prints its own totals,
    // and an unscoped text query would now match either.
    renderSidebar();
    const row = screen.getByRole('button', { name: /İstanbul/u });
    expect(within(row).getByText('İstanbul')).toBeInTheDocument();
    expect(within(row).getByText('900')).toBeInTheDocument();
    expect(within(row).getByText('%60,0')).toBeInTheDocument();
  });

  it('says so when there is nothing to list', () => {
    renderSidebar([]);
    expect(screen.getByText(trStrings.sidebar.empty)).toBeInTheDocument();
  });

  it('requests a fly-to when a row is clicked', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /İstanbul/u }));
    expect(store.getState().flyToRequest).toBe('34');
  });

  it('opens the region, exactly as clicking it on the map does', () => {
    // Selecting and flying without opening left the reader looking at a zoomed
    // map with an outlined region and no answer to the question the click asked.
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Ankara/u }));
    expect(store.getState().detail).toEqual({ code: '06', level: 'il' });
  });

  it('opens at whatever level the map is outlining', () => {
    const zoomed: HeatMapState = { ...base, level: 'ilce' };
    const { store } = renderSidebar(ROWS, zoomed);
    fireEvent.click(screen.getByRole('button', { name: /Ankara/u }));
    expect(store.getState().detail).toEqual({ code: '06', level: 'ilce' });
  });

  it('selects the region it flew to', () => {
    const { store } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Ankara/u }));
    expect(store.getState().selectedCode).toBe('06');
  });

  it('highlights the map region on row hover, tagged as a list hover', () => {
    const { hoverStore } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İzmir/u }));
    expect(hoverStore.getState()).toEqual({ code: '35', x: 0, y: 0, source: 'list' });
  });

  it('clears the highlight on row leave', () => {
    const { hoverStore } = renderSidebar();
    const row = screen.getByRole('button', { name: /İzmir/u });
    fireEvent.pointerEnter(row);
    fireEvent.pointerLeave(row);
    expect(hoverStore.getState()).toBeNull();
  });

  it('marks the row matching a hover, so the link works in both directions', () => {
    const { container } = renderSidebar();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /İstanbul/u }));
    expect(container.querySelector('[data-hovered="true"]')?.textContent)
      .toContain('İstanbul');
  });

  it('marks the selected row as current', () => {
    const selected: HeatMapState = { ...base, selectedCode: '06' };
    renderSidebar(ROWS, selected);
    expect(screen.getByRole('button', { name: /Ankara/u })).toHaveAttribute('aria-current', 'true');
  });

  it('tints each row bar with that region heat colour', () => {
    const { container } = renderSidebar();
    const bar = container.querySelector('[data-role="bar"]') as HTMLElement;
    expect(bar.style.background).not.toBe('');
  });
});

describe('Sidebar — the top ten', () => {
  it('lists only the ten highest, however many regions there are', () => {
    const { container } = renderSidebar(manyRows(81));
    expect(container.querySelectorAll('[data-role="row"]')).toHaveLength(10);
  });

  it('takes the ten by count, not an arbitrary ten', () => {
    const { container } = renderSidebar(manyRows(81));
    const names = [...container.querySelectorAll('[data-role="row"]')]
      .map((row) => row.textContent ?? '');
    // manyRows is already ranked, so the head of it is the top by total.
    expect(names[0]).toContain('Bölge 000');
    expect(names[9]).toContain('Bölge 009');
  });

  it('shows fewer than ten without complaint when that is all there is', () => {
    const { container } = renderSidebar();
    expect(container.querySelectorAll('[data-role="row"]')).toHaveLength(3);
  });

  it('numbers the rows by their position in the list', () => {
    const { container } = renderSidebar();
    const first = container.querySelectorAll('[data-role="row"]')[0]!;
    expect(first.textContent).toMatch(/^1/u);
  });

  it('exposes the leaderboard as an ordered list', () => {
    // The visible numbering is aria-hidden, so the ordinality has to be real.
    const { container } = renderSidebar();
    expect(container.querySelector('ol')).not.toBeNull();
  });

});

describe('Sidebar — what the header states', () => {
  it('names the country rather than the panel', () => {
    renderSidebar();
    expect(screen.getByRole('heading', { name: trStrings.sidebar.title }))
      .toBeInTheDocument();
    expect(trStrings.sidebar.title).toBe('Türkiye');
  });

  it('states the total the three sections below it break down', () => {
    // Without it the rail offered three breakdowns of a number it never gave.
    const { container } = renderSidebar();
    expect(container.querySelector('[data-role="scope-total"]')?.textContent)
      .toContain('1.500');
  });

  it('labels that number for a screen reader, which cannot see the context', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('[data-role="scope-total"]')?.textContent)
      .toContain(trStrings.detail.total);
  });
});

describe('Sidebar — the charts it carries', () => {
  it('puts both charts in the rail', () => {
    renderSidebar();
    expect(screen.getByRole('group', { name: trStrings.pie.title })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });

  it('drops a chart whose section is off, keeping the rest', () => {
    renderSidebar(ROWS, base, { pie: false, trend: true, list: true });
    expect(screen.queryByRole('group', { name: trStrings.pie.title })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
  });

  it('keeps the charts when the list section is off', () => {
    renderSidebar(ROWS, base, { pie: true, trend: true, list: false });
    expect(screen.queryByText('İstanbul')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: trStrings.trend.title })).toBeInTheDocument();
  });


  it('leaves the donut scope line out, since the rail is the national view', () => {
    // "Türkiye geneli" under a panel that is by definition the national picture
    // is a caption restating its own container.
    renderSidebar();
    expect(screen.queryByText(trStrings.pie.national)).not.toBeInTheDocument();
  });

  it('renders the charts flat, not as cards inside a card', () => {
    renderSidebar();
    for (const title of [trStrings.trend.title, trStrings.pie.title]) {
      expect(screen.getByRole('group', { name: title }).className, title).toMatch(/flat/u);
    }
  });

  it('orders the rail year series, then leaderboard, then donut', () => {
    // Time, then place, then category — each section narrowing the one above.
    const { container } = renderSidebar();
    const body = container.querySelector('[class*="body"]')!;
    // Each band is a plain wrapper; the labelled element is the one inside it.
    const order = [...body.children]
      .map((band) => band.firstElementChild?.getAttribute('aria-label') ?? null);
    expect(order).toEqual([
      trStrings.trend.title,
      trStrings.sidebar.topList,
      trStrings.pie.title,
    ]);
  });

  it('puts the donut key beside the drawing rather than under it', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('[data-role="pie-body"]'))
      .toHaveAttribute('data-legend', 'beside');
  });
});

describe('Sidebar — collapsing', () => {
  /**
   * The regression this pins: the collapsed width was expressed as
   * `.sidebar[data-collapsed='true']`, but GlassPanel forwards `className` and
   * nothing else, so the attribute never reached the DOM. The panel stayed
   * full width with its contents hidden and the button looked inert.
   */
  it('marks the rail collapsed, which is what slides the panel away', () => {
    const { container } = renderSidebar();
    const rail = container.querySelector('[class*="rail"]') as HTMLElement;
    expect(rail).toHaveAttribute('data-collapsed', 'false');

    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));
    expect(rail).toHaveAttribute('data-collapsed', 'true');
  });

  it('keeps the handle, which is the only way back', () => {
    // The regression this pins: the toggle used to live in the panel's header,
    // so collapsing carried it off the edge of the screen along with the panel.
    const { container } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));

    const handle = container.querySelector('[data-role="rail-toggle"]');
    expect(handle).not.toBeNull();
    expect(handle).toHaveAttribute('aria-label', trStrings.sidebar.expand);
  });

  it('hides the panel from assistive tech while collapsed', () => {
    // Still mounted, so it has something to animate — but out of the tab order
    // and out of the accessibility tree, which is what "hidden" has to mean.
    const { container } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));

    const panel = container.querySelector('[class*="sidebar"]') as HTMLElement;
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: /İstanbul/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: trStrings.trend.title })).not.toBeInTheDocument();
  });

  it('reports its state on the handle', () => {
    const { container } = renderSidebar();
    const handle = container.querySelector('[data-role="rail-toggle"]')!;
    expect(handle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));
    expect(handle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands again, restoring the panel and everything in it', () => {
    const { container } = renderSidebar();
    const panel = container.querySelector('[class*="sidebar"]') as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.collapse }));
    fireEvent.click(screen.getByRole('button', { name: trStrings.sidebar.expand }));

    expect(panel).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('button', { name: /İstanbul/u })).toBeInTheDocument();
  });
});
