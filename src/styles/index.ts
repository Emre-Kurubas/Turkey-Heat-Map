import './tokens.css';
import './base.css';

/**
 * Every themeable custom property.
 *
 * The `theme` prop (§8) writes these onto the root element as inline styles.
 * Keeping the list in code lets an unknown key be rejected with a real warning
 * instead of silently doing nothing, and the token test holds the list and the
 * stylesheet to each other in both directions.
 */
export const THEME_TOKEN_NAMES = [
  '--hm-glass-bg',
  '--hm-glass-bg-solid',
  '--hm-glass-border',
  '--hm-glass-blur',
  '--hm-glass-shadow',
  '--hm-radius',
  '--hm-map-bg',
  '--hm-border-stroke',
  '--hm-border-width',
  '--hm-focus-ring',
  '--hm-no-data',
  '--hm-font',
  '--hm-fg',
  '--hm-fg-muted',
  '--hm-motion-hover',
  '--hm-motion-panel',
  '--hm-motion-color',
  '--hm-motion-fly',
  '--hm-motion-level',
  '--hm-ease-hover',
  '--hm-ease-panel',
  '--hm-ease-color',
  '--hm-ease-fly',
  '--hm-ease-level',
] as const satisfies readonly `--hm-${string}`[];

export type ThemeTokenName = typeof THEME_TOKEN_NAMES[number];
