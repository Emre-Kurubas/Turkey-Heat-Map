import { useCallback } from 'react';
import type { RankedRegion } from '@/core/aggregation/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import { useHeatMapDispatch, useStrings } from '@/hooks/useHeatMapState.js';
import { useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import styles from './RegionDetail.module.css';

export interface RegionChildListProps {
  /**
   * Already ranked and already cut to the head of the list.
   *
   * Named `districts` rather than `children`: a prop by that name would read as
   * React's own, and this is data.
   */
  districts: readonly RankedRegion[];
}

/**
 * The districts inside the open province, biggest first.
 *
 * Rows are buttons, not text: this is the natural way down a level, and the
 * province panel is exactly where someone decides which district to look at
 * next. Opening one replaces this panel with that district's.
 */
export function RegionChildList({ districts }: RegionChildListProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const setHover = useSetHoverTarget();

  const open = useCallback((code: string) => {
    dispatch({ type: 'openDetail', code, level: 'ilce' });
    dispatch({ type: 'requestFlyTo', code });
  }, [dispatch]);

  const onHover = useCallback((code: string | null) => {
    if (code === null) { setHover({ type: 'leave' }); return; }
    // Coordinates are meaningless for a list hover; `source` is what stops the
    // tooltip opening in the corner attached to nothing.
    setHover({ type: 'enter', target: { code, x: 0, y: 0, source: 'list' } });
  }, [setHover]);

  if (districts.length === 0) {
    return <p className={styles.empty}>{strings.detail.noChildren}</p>;
  }

  return (
    <ol className={styles.childList}>
      {districts.map((district, index) => (
        <li key={district.code}>
          <button
            type="button"
            data-role="child-row"
            data-code={district.code}
            className={styles.childRow}
            onClick={() => { open(district.code); }}
            onPointerEnter={() => { onHover(district.code); }}
            onPointerLeave={() => { onHover(null); }}
          >
            {/* Decorative: this is an <ol>, so a screen reader already counts. */}
            <span className={styles.childRank} aria-hidden="true">{index + 1}</span>
            <span className={styles.childName}>{district.name}</span>
            <span className={styles.childValue}>{formatTrNumber(district.total)}</span>
            <span className={styles.childShare}>{formatPercent(district.share)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
