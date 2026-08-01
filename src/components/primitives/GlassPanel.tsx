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
}

/** The floating glass surface every panel sits on. */
export function GlassPanel({ children, className, label }: GlassPanelProps) {
  return (
    <div
      className={className === undefined ? styles.panel! : `${styles.panel!} ${className}`}
      {...(label === undefined ? {} : { role: 'group', 'aria-label': label })}
    >
      {children}
    </div>
  );
}
