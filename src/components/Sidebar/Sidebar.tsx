import { useCallback, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { IconButton } from '@/components/primitives/IconButton.js';
import type { RankedRegion } from '@/core/aggregation/index.js';
import type { ColorScale } from '@/core/color/index.js';
import { compareTurkish } from '@/core/search/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget, useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import { useVirtualList } from '@/hooks/useVirtualList.js';
import { SidebarRow } from './SidebarRow.js';
import styles from './Sidebar.module.css';

const ROW_HEIGHT = 26;

export interface SidebarProps {
  rows: readonly RankedRegion[];
  scale: ColorScale;
}

export function Sidebar({ rows, scale }: SidebarProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const setHover = useSetHoverTarget();
  const hover = useHoverTarget();
  const selectedCode = useHeatMapState((state) => state.selectedCode);

  // Sort and collapse are this panel's own affair — no other panel reads them,
  // so they stay out of the shared store (§7.8).
  const [byName, setByName] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sorted = useMemo(() => (
    byName ? [...rows].sort((a, b) => compareTurkish(a.name, b.name)) : rows
  ), [rows, byName]);

  const list = useVirtualList(ROW_HEIGHT, sorted.length);

  const onActivate = useCallback((code: string) => {
    dispatch({ type: 'select', code });
    dispatch({ type: 'requestFlyTo', code });
  }, [dispatch]);

  const onHover = useCallback((code: string | null) => {
    if (code === null) { setHover({ type: 'leave' }); return; }
    // Coordinates are meaningless for a list hover; `source` is what stops the
    // tooltip opening in the corner attached to nothing.
    setHover({ type: 'enter', target: { code, x: 0, y: 0, source: 'list' } });
  }, [setHover]);

  const slice = sorted.slice(list.window.startIndex, list.window.endIndex);

  return (
    <GlassPanel label={strings.sidebar.title} className={styles.sidebar}>
      <div className={styles.header}>
        {collapsed ? null : <h2 className={styles.title}>{strings.sidebar.title}</h2>}
        <div className={styles.actions}>
          {collapsed ? null : (
            <IconButton
              label={byName ? strings.sidebar.sortByTotal : strings.sidebar.sortByName}
              onClick={() => { setByName((v) => !v); }}
            >
              {byName ? '#' : 'A'}
            </IconButton>
          )}
          <IconButton
            label={collapsed ? strings.sidebar.expand : strings.sidebar.collapse}
            onClick={() => { setCollapsed((v) => !v); }}
          >
            {collapsed ? '»' : '«'}
          </IconButton>
        </div>
      </div>

      {collapsed ? null : (
        <div ref={list.ref} className={styles.scroller} onScroll={list.onScroll}>
          {sorted.length === 0 ? (
            <p className={styles.empty}>{strings.sidebar.empty}</p>
          ) : (
            <div className={styles.spacer} style={{ height: list.window.totalHeight }}>
              <div
                className={styles.slice}
                style={{ transform: `translateY(${list.window.offsetY}px)` }}
              >
                {slice.map((region) => (
                  <SidebarRow
                    key={region.code}
                    region={region}
                    color={scale(region.total)}
                    hovered={hover?.code === region.code}
                    selected={selectedCode === region.code}
                    height={ROW_HEIGHT}
                    onActivate={onActivate}
                    onHover={onHover}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
