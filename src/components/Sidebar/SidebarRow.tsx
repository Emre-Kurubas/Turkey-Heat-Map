import type { RankedRegion } from '@/core/aggregation/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import styles from './Sidebar.module.css';

export interface SidebarRowProps {
  region: RankedRegion;
  /** 1-based position in the list as displayed. */
  position: number;
  color: string;
  hovered: boolean;
  selected: boolean;
  onActivate: (code: string) => void;
  onHover: (code: string | null) => void;
  height: number;
}

/** One ranked region. Position, name, count, share, and a heat-tinted bar. */
export function SidebarRow({
  region, position, color, hovered, selected, onActivate, onHover, height,
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
      {/* Decorative: the list is an <ol>, so a screen reader already counts. */}
      <span className={styles.rowRank} aria-hidden="true">{position}</span>
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
