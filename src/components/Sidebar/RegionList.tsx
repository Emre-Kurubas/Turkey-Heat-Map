import { useCallback } from 'react';
import type { RankedRegion } from '@/core/aggregation/index.js';
import type { ColorScale } from '@/core/color/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget, useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import { SidebarRow } from './SidebarRow.js';
import styles from './Sidebar.module.css';

const ROW_HEIGHT = 28;

export interface RegionListProps {
  /**
   * Exactly the rows to draw, in the order to draw them. Ranking and cutting
   * happen in the rail, which is where the "top ten by count, then optionally
   * alphabetised" rule lives — enforcing the cap in both places would be two
   * copies of one decision.
   */
  rows: readonly RankedRegion[];
  scale: ColorScale;
}

/**
 * The leaderboard rows.
 *
 * Deliberately not virtualised. Its predecessor windowed a list of all 973
 * districts, which was the right machinery for that list and pure overhead for
 * ten rows — the window arithmetic, the scroll listener and the height-reserving
 * spacer all existed to avoid rendering rows that no longer exist.
 */
export function RegionList({ rows, scale }: RegionListProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const setHover = useSetHoverTarget();
  const hover = useHoverTarget();
  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const level = useHeatMapState((state) => state.level);

  /*
   * A row does exactly what clicking the region on the map does: opens its
   * panel and flies there.
   *
   * It used to only select and fly, which left the reader looking at a zoomed
   * map with a highlighted outline and no answer to the question the click was
   * asking. Two controls pointing at the same region should not disagree about
   * what pointing at it means.
   *
   * The level comes from the store because these rows are whatever the map is
   * currently outlining — provinces at country zoom, districts once zoomed in.
   */
  const onActivate = useCallback((code: string) => {
    dispatch({ type: 'openDetail', code, level });
    dispatch({ type: 'requestFlyTo', code });
  }, [dispatch, level]);

  const onHover = useCallback((code: string | null) => {
    if (code === null) { setHover({ type: 'leave' }); return; }
    // Coordinates are meaningless for a list hover; `source` is what stops the
    // tooltip opening in the corner attached to nothing.
    setHover({ type: 'enter', target: { code, x: 0, y: 0, source: 'list' } });
  }, [setHover]);

  if (rows.length === 0) {
    return <p className={styles.empty}>{strings.sidebar.empty}</p>;
  }

  return (
    <ol className={styles.list}>
      {rows.map((region, index) => (
        <li key={region.code}>
          <SidebarRow
            region={region}
            // The position in *this* list, not the region's rank in the full
            // ranking: sorted by name, "1." labelling the fourth-biggest region
            // would be a claim about the data rather than about the row.
            position={index + 1}
            color={scale(region.total)}
            hovered={hover?.code === region.code}
            selected={selectedCode === region.code}
            height={ROW_HEIGHT}
            onActivate={onActivate}
            onHover={onHover}
          />
        </li>
      ))}
    </ol>
  );
}
