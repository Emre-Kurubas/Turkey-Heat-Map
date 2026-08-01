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
