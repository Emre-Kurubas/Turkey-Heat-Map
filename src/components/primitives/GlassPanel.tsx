import type { ReactNode } from 'react';
import styles from './GlassPanel.module.css';

export interface GlassPanelProps {
  children: ReactNode;
  /**
   * Explicit `undefined` is allowed, not just omission. Under
   * `exactOptionalPropertyTypes` a plain `string?` would reject both a
   * forwarded optional prop and a CSS-Modules lookup, which
   * `noUncheckedIndexedAccess` types as `string | undefined`.
   */
  className?: string | undefined;
  /** Accessible name. Omit for purely decorative containers. */
  label?: string | undefined;
  /**
   * Drops the fill, border and shadow, keeping only the grouping and the
   * accessible name.
   *
   * For a panel nested inside another one. Glass over glass doubles the blur
   * and draws a second border a few pixels inside the first, which reads as a
   * rendering fault rather than as depth — the region detail panel had exactly
   * that, with two bordered cards floating inside a third.
   */
  flat?: boolean | undefined;
  /**
   * Takes the panel and everything in it out of the accessibility tree.
   *
   * For a panel that is still mounted only so it has something to animate —
   * the left rail stays in the DOM while collapsed so it can slide back.
   */
  'aria-hidden'?: true | undefined;
  /**
   * A stable hook for tests and for host-page styling, since the class name is
   * hashed by CSS Modules and the accessible name is translatable.
   */
  'data-role'?: string | undefined;
}

/** The floating glass surface every panel sits on. */
export function GlassPanel({
  children, className, label, flat = false,
  'aria-hidden': ariaHidden, 'data-role': dataRole,
}: GlassPanelProps) {
  const base = flat ? `${styles.panel!} ${styles.flat!}` : styles.panel!;
  return (
    <div
      className={className === undefined ? base : `${base} ${className}`}
      {...(label === undefined ? {} : { role: 'group', 'aria-label': label })}
      {...(ariaHidden === undefined ? {} : { 'aria-hidden': ariaHidden })}
      {...(dataRole === undefined ? {} : { 'data-role': dataRole })}
    >
      {children}
    </div>
  );
}
