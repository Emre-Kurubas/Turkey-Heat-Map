import styles from './Chip.module.css';

export interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** Category colour, shown as a swatch. Omit for a plain chip. */
  color?: string | undefined;
  /** Pre-formatted count. Colour is a summary; the number is the truth (§6.5). */
  count?: string | undefined;
  /** Set while the matching pie slice is hovered. */
  highlighted?: boolean | undefined;
}

/** A toggleable filter chip. */
export function Chip({ label, selected, onToggle, color, count, highlighted }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={selected}
      data-highlighted={highlighted === true ? 'true' : 'false'}
      onClick={onToggle}
    >
      {color === undefined ? null : (
        <span className={styles.swatch} data-role="swatch" style={{ background: color }} />
      )}
      <span>{label}</span>
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
    </button>
  );
}
