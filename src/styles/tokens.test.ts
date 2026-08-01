import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_TOKEN_NAMES } from './index.js';

const css = readFileSync(
  fileURLToPath(new URL('./tokens.css', import.meta.url)),
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
      'hm-area-topLeft', 'hm-area-topCentre', 'hm-area-topRight',
      'hm-area-left', 'hm-area-right', 'hm-area-bottomLeft',
    ]) {
      expect(base, area).toContain(`.${area}`);
    }
  });

  it('declares no size breakpoints, since panel positions are fixed', () => {
    expect(base).not.toContain('@media');
  });
});
