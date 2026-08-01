import type { RankedRegion } from '@/core/aggregation/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import styles from './Sidebar.module.css';

export interface SidebarRowProps {
  region: RankedRegion;
  color: string;
  hovered: boolean;
  selected: boolean;
  onActivate: (code: string) => void;
  onHover: (code: string | null) => void;
  height: number;
}

/** One ranked region. Name, count, share, and a bar tinted with its heat colour. */
export function SidebarRow({
  region, color, hovered, selected, onActivate, onHover, height,
}: SidebarRowProps) {
  return (
    <button
      type="button"
      data-role="row"
      data-hovered={hovered ? 'true' : 'false'}
      className={styles.row}
      style={{ height }}
      {...(selected ? { 'aria-current': true as const } : {})}
      onClick={() => { onActivate(region.code); }}
      onPointerEnter={() => { onHover(region.code); }}
      onPointerLeave={() => { onHover(null); }}
    >
      <span className={styles.rowName}>{region.name}</span>
      <span className={styles.rowTotal}>{formatTrNumber(region.total)}</span>
      <span className={styles.rowShare}>{formatPercent(region.share)}</span>
      <span
        className={styles.bar}
        data-role="bar"
        style={{ width: `${Math.max(2, region.share * 100)}%`, background: color }}
        aria-hidden="true"
      />
    </button>
  );
}
