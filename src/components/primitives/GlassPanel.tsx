import type { ReactNode } from 'react';
import styles from './GlassPanel.module.css';

export interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  /** Accessible name. Omit for purely decorative containers. */
  label?: string;
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
