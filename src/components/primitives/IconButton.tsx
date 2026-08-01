import type { ReactNode } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  /** Accessible name. The glyph itself is hidden from assistive tech. */
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Omit for a plain button; a boolean makes it a toggle. */
  pressed?: boolean | undefined;
  className?: string | undefined;
}

export function IconButton({ label, onClick, children, pressed, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={className === undefined ? styles.button! : `${styles.button!} ${className}`}
      aria-label={label}
      // aria-pressed on a non-toggle would announce a state that does not exist.
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
