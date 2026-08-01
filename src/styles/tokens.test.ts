import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_TOKEN_NAMES } from './index.js';

const css = readFileSync(
  fileURLToPath(new URL('./tokens.css', import.meta.url)),
  'utf8',
);

/*
 * Component stylesheets whose *layout* is a stated requirement rather than a
 * detail. They are asserted here, in the node project, because jsdom does not
 * lay out: a rendered node reports no geometry, so every position looks
 * identical to it and a DOM test cannot tell a left-anchored panel from a
 * bottom-anchored one.
 */
const detailCss = readFileSync(
  fileURLToPath(new URL('../components/RegionDetail/RegionDetail.module.css', import.meta.url)),
  'utf8',
);

const sidebarCss = readFileSync(
  fileURLToPath(new URL('../components/Sidebar/Sidebar.module.css', import.meta.url)),
  'utf8',
);

describe('design tokens', () => {
  it('declares every token the theme prop advertises', () => {
    for (const name of THEME_TOKEN_NAMES) {
      expect(css, name).toContain(`${name}:`);
    }
  });

  it('advertises every token the stylesheet declares', () => {
    const declared = [...css.matchAll(/(--hm-[a-z0-9-]+)\s*:/gu)].map((m) => m[1]!);
    for (const name of new Set(declared)) {
      expect(THEME_TOKEN_NAMES, name).toContain(name);
    }
  });

  it('collapses every duration to zero under reduced motion', () => {
    const block = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(block).toMatch(/--hm-motion-hover:\s*0m?s/u);
    expect(block).toMatch(/--hm-motion-fly:\s*0m?s/u);
    expect(block).toMatch(/--hm-motion-level:\s*0m?s/u);
    expect(block).toMatch(/--hm-motion-color:\s*0m?s/u);
    expect(block).toMatch(/--hm-motion-panel:\s*0m?s/u);
  });

  it('keeps a solid glass fallback distinct from the translucent fill', () => {
    expect(css).toContain('--hm-glass-bg-solid:');
    expect(css).toContain('--hm-glass-bg:');
  });
});

describe('light theme', () => {
  it('uses a light map surface', () => {
    expect(css).toContain('--hm-map-bg: #eef1f6');
  });

  it('uses dark ink, since the surfaces are now light', () => {
    const fg = /--hm-fg:\s*([^;]+);/u.exec(css)?.[1] ?? '';
    // A light-on-light foreground is the classic failed theme flip.
    expect(fg).not.toMatch(/255,\s*255,\s*255/u);
  });

  it('draws region borders in dark ink rather than white', () => {
    const stroke = /--hm-border-stroke:\s*([^;]+);/u.exec(css)?.[1] ?? '';
    expect(stroke).not.toMatch(/255,\s*255,\s*255/u);
  });

  it('declares no dark-mode media query, since light is the only theme', () => {
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('keeps the reduced-motion block, which is not a theme concern', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('base stylesheet', () => {
  const base = readFileSync(
    fileURLToPath(new URL('./base.css', import.meta.url)),
    'utf8',
  );

  /**
   * Regression guard. This class is only ever applied to content that is meant
   * to be invisible, so losing it has no failing assertion anywhere else — it
   * just dumps the trend chart's data table onto the page.
   */
  it('declares the visually-hidden helper', () => {
    expect(base).toContain('.hm-visually-hidden');
    expect(base).toMatch(/\.hm-visually-hidden\s*\{[^}]*clip-path/u);
  });

  it('declares every grid area the layout positions panels into', () => {
    for (const area of [
      'hm-area-topCentre', 'hm-area-left',
      'hm-area-bottomRight', 'hm-area-bottomCentre',
    ]) {
      expect(base, area).toContain(`.${area}`);
    }
  });

  it('declares no area for the chart cards that moved into the rail', () => {
    // Dead positioning rules are how a layout accumulates slots nothing can
    // land in. Both charts are sections of the left rail now; the top-right
    // area survives because the year-range caption took it over.
    expect(base).not.toContain('hm-area-right ');
    expect(base).not.toMatch(/\.hm-area-right\s*\{/u);
  });

  it('gives the sidebar column the full height to size itself against', () => {
    // The panel shrinks to its content, but its `max-height: 100%` has to
    // resolve against something definite — this stretched column is it.
    // Without it the cap is indefinite and a long list runs off the map.
    expect(base).toMatch(/\.hm-area-left\s*\{[^}]*align-self:\s*stretch/u);
  });

  it('insets the sidebar column from the top and bottom of the frame', () => {
    // Stretching it edge to edge made it read as window chrome rather than as
    // a panel floating over the map.
    const start = base.indexOf('.hm-area-left {');
    const rule = base.slice(start, base.indexOf('}', start));
    expect(rule).toMatch(/margin-block:\s*\d+px/u);
  });

  it('gives the sidebar column all three rows, top to bottom', () => {
    // Named in every row of the template, which is what makes the grid span it.
    const areas = base.slice(base.indexOf('grid-template-areas'));
    const rows = areas.slice(0, areas.indexOf(';')).match(/"[^"]*"/gu) ?? [];
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toContain('left');
  });

  it('declares no size breakpoints, since panel positions are fixed', () => {
    expect(base).not.toContain('@media');
  });

  it('centres the control row on the frame rather than on a grid column', () => {
    // As a grid item it was centred in whatever space the left rail left over,
    // so collapsing the rail slid the search field and the filter button
    // sideways. Nothing about those controls has to do with the rail.
    const start = base.indexOf('.hm-area-topCentre {');
    const rule = base.slice(start, base.indexOf('}', start));
    expect(rule).toMatch(/position:\s*absolute/u);
    expect(rule).toMatch(/left:\s*50%/u);
    expect(rule).toMatch(/translateX\(-50%\)/u);
    expect(rule).not.toMatch(/grid-area/u);
  });
});

/*
 * The overlay disables pointer events so the map stays draggable between
 * panels. Anything rendered into a `hm-area-*` slot has to turn them back on
 * for itself, and the two components that do not sit on a GlassPanel have to do
 * it by hand — the search bar did not, and every click on it fell through to
 * the map underneath.
 */
describe('overlay children take their pointer events back', () => {
  const readModule = (path: string): string =>
    readFileSync(fileURLToPath(new URL(`../components/${path}`, import.meta.url)), 'utf8');

  it('turns them off on the overlay itself', () => {
    const base = readFileSync(fileURLToPath(new URL('./base.css', import.meta.url)), 'utf8');
    expect(base).toMatch(/\.hm-overlay\s*\{[^}]*pointer-events:\s*none/u);
  });

  it.each([
    ['SearchBar/SearchBar.module.css', '.wrapper'],
    ['Attribution/Attribution.module.css', '.attribution'],
    ['primitives/GlassPanel.module.css', '.panel'],
  ])('turns them back on in %s', (path, selector) => {
    const css = readModule(path);
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/pointer-events:\s*auto/u);
  });
});

describe('sidebar stylesheet', () => {
  it('rules a line between the rail sections', () => {
    // Three stacked blocks of small type read as one long block without them.
    expect(sidebarCss).toMatch(/\.body\s*>\s*\*\s*\+\s*\*\s*\{[^}]*border-top/u);
  });

  it('pads every band equally, so a rule lands midway between two sections', () => {
    // Not a top margin: with space on one side only, a chart sits hard against
    // the line above it and floats away from the line below.
    expect(sidebarCss).toMatch(/\.section\s*\{[^}]*padding-block:\s*var\(--band-pad\)/u);
    const start = sidebarCss.indexOf('.body > * + *');
    const rule = sidebarCss.slice(start, sidebarCss.indexOf('}', start));
    expect(rule).not.toMatch(/margin-top/u);
    expect(rule).not.toMatch(/padding-top/u);
  });

  it('is as tall as its content rather than as tall as the map', () => {
    // Pinned to the full height, the difference between what three sections
    // need and what the map offers came out as empty glass under the donut.
    const start = sidebarCss.indexOf('.sidebar {');
    const rule = sidebarCss.slice(start, sidebarCss.indexOf('}', start));
    expect(rule).toMatch(/height:\s*auto/u);
    expect(rule).toMatch(/max-height:\s*100%/u);
  });

  it('singles out no band for special height treatment', () => {
    // With the panel shrinking to fit there is no leftover to absorb, and
    // growing a band into a space that does not exist would put the gap back.
    expect(sidebarCss).not.toMatch(/:last-child\s*\{[^}]*flex:\s*1/u);
  });

  it('keeps the other bands at their natural height', () => {
    // Without `flex: none` a scrolling column squashes them instead of
    // scrolling, which is the usual way this construction goes wrong.
    const start = sidebarCss.indexOf('.section {');
    const rule = sidebarCss.slice(start, sidebarCss.indexOf('}', start));
    expect(rule).toMatch(/flex:\s*none/u);
  });

  it('pulls the handle flush with the frame once the panel is gone', () => {
    // The rail's left offset is the overlay's 12px padding, and while collapsed
    // there is nothing left for that padding to hold off the edge.
    const collapsed = sidebarCss.slice(sidebarCss.indexOf(".rail[data-collapsed='true'] .handle"));
    expect(collapsed).toMatch(/margin-left:\s*-12px/u);
  });

  it('draws that rule only between sections, never above the first', () => {
    // `* + *` and not `*`, which is the whole reason a section switched off
    // cannot leave a line hanging above nothing.
    expect(sidebarCss).not.toMatch(/\.body\s*>\s*\*\s*\{[^}]*border-top/u);
  });

  it('carries the more opaque fill', () => {
    // Rebound as a custom property, so GlassPanel's own rule resolves it and
    // stylesheet order cannot decide the winner.
    const start = sidebarCss.indexOf('.sidebar {');
    const rule = sidebarCss.slice(start, sidebarCss.indexOf('}', start));
    expect(rule).toContain('--hm-glass-bg: var(--hm-glass-bg-strong)');
  });

  it('slides the collapsed panel out of its own column', () => {
    // A transform would leave a 380px hole where the panel used to be: the
    // grid column is sized by this element's layout box, and only a margin
    // change collapses it.
    const collapsed = sidebarCss.slice(sidebarCss.indexOf(".rail[data-collapsed='true']"));
    expect(collapsed).toMatch(/margin-left:\s*calc\(-1 \* var\(--rail-width\)\)/u);
    expect(collapsed).toMatch(/visibility:\s*hidden/u);
  });

  it('cancels the panel width exactly, so the handle lands on the frame edge', () => {
    // One source for both numbers. Overshooting the width would drag the
    // handle off the map along with the panel it is meant to bring back, and a
    // percentage would resolve against the wrong box entirely.
    expect(sidebarCss).toMatch(/--rail-width:\s*\d+px/u);
    expect(sidebarCss).toMatch(/width:\s*var\(--rail-width\)/u);
    expect(sidebarCss).not.toMatch(/margin-left:\s*calc\(-100%/u);
  });

  it('anchors the handle to the rail rather than putting it in the panel', () => {
    // The regression: the toggle used to live in the header and rode off the
    // edge of the screen with the panel it was meant to bring back.
    const start = sidebarCss.indexOf('.handle {');
    const rule = sidebarCss.slice(start, sidebarCss.indexOf('}', start));
    expect(rule).toMatch(/position:\s*absolute/u);
    expect(rule).toMatch(/left:\s*100%/u);
    expect(sidebarCss).not.toMatch(/\.sidebar\s+\.handle/u);
  });
});

describe('region detail stylesheet', () => {
  const panelRule = detailCss.slice(
    detailCss.indexOf('.panel {'),
    detailCss.indexOf('}', detailCss.indexOf('.panel {')),
  );

  it('sits in the same band as the rail it replaces', () => {
    // The rail lands 40px in from the top and bottom — a 28px grid-area margin
    // inside a 12px overlay padding — and is centred there. This panel is
    // positioned against the root instead, so it rebuilds that band by hand.
    expect(panelRule).toMatch(/left:\s*12px/u);
    expect(panelRule).toMatch(/top:\s*40px/u);
    expect(panelRule).toMatch(/bottom:\s*40px/u);
    // `right` would stretch it back across the full width.
    expect(panelRule).not.toMatch(/right:/u);
  });

  it('fits its contents and centres the result, as the rail does', () => {
    // `margin-block: auto` against both offsets is what centres an absolutely
    // positioned box without a transform — which matters, because the slide-in
    // animation owns the transform.
    expect(panelRule).toMatch(/height:\s*fit-content/u);
    expect(panelRule).toMatch(/margin-block:\s*auto/u);
    expect(panelRule).toMatch(/max-height:\s*calc\(100% - 80px\)/u);
  });

  it('reserves the list band fullest case, which is what fixes the height', () => {
    // The charts are fixed drawings; the list is what has three rows for one
    // region and ten for the next. Holding room for ten makes the contents a
    // constant size, so fitting to them lands on the same number every time —
    // no magic total, and nothing to scroll.
    const start = detailCss.indexOf('.listBand {');
    const rule = detailCss.slice(start, detailCss.indexOf('}', start));
    expect(rule).toMatch(/min-height:\s*calc\([^)]*var\(--child-rows\)/u);
    expect(rule).toMatch(/align-content:\s*start/u);
    expect(panelRule).toMatch(/--child-rows:\s*10/u);
  });

  it('rules nothing between the category rows', () => {
    // The panel's own lines separate its three bands and mean something there.
    // Repeated under every category they made a list of hairlines the heaviest
    // thing on the card — and put the table out of step with the district list
    // that fills the same slot in a province's panel.
    expect(detailCss).not.toMatch(/\.row\s*\{[^}]*border-bottom/u);
  });

  it('keeps the category rows and the district rows on one rhythm', () => {
    // Same job, same slot; they should not be different heights.
    expect(detailCss).toMatch(/\.row\s*\{[^}]*height:\s*var\(--child-row-h\)/u);
    expect(detailCss).toMatch(/\.childRow\s*\{[^}]*height:\s*var\(--child-row-h\)/u);
  });

  it('rules its header, as the rail rules its own', () => {
    const start = detailCss.indexOf('.header {');
    const rule = detailCss.slice(start, detailCss.indexOf('}', start));
    expect(rule).toMatch(/border-bottom:\s*1px solid var\(--hm-glass-border\)/u);
    expect(rule).toMatch(/padding:\s*10px 12px var\(--band-pad\)/u);
  });

  it('matches the rail it stands in for, so nothing shifts under the click', () => {
    // Read from the rail rather than hard-coded, so the two cannot drift: they
    // occupy the same corner, and a panel arriving wider than the one it
    // replaced reads as the layout moving under the click.
    const railWidth = /--rail-width:\s*(\d+)px/u.exec(sidebarCss)?.[1];
    expect(railWidth).toBeDefined();
    expect(panelRule).toMatch(new RegExp(String.raw`--panel-width:\s*${railWidth!}px`, 'u'));
  });

  it('uses the same band padding as the rail', () => {
    const railPad = /--band-pad:\s*(\d+)px/u.exec(sidebarCss)?.[1];
    expect(railPad).toBeDefined();
    expect(panelRule).toMatch(new RegExp(String.raw`--band-pad:\s*${railPad!}px`, 'u'));
  });

  it('never lets it outgrow a narrow container', () => {
    expect(panelRule).toMatch(/max-width:\s*calc\(100% - 24px\)/u);
  });

  it('slides it in from the edge it is anchored to', () => {
    const keyframes = detailCss.slice(detailCss.indexOf('@keyframes slideIn'));
    expect(keyframes).toContain('translateX');
  });
});
