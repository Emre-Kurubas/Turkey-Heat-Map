import { useEffect, useMemo, useRef, useState } from 'react';
import type { RollupResult } from '@/core/aggregation/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import { placeTooltip } from '@/core/geo/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget } from '@/hooks/useHoverTarget.js';
import styles from './HoverTooltip.module.css';

/** Long enough to swallow fast traversal, short enough to feel immediate. */
const SHOW_DELAY_MS = 60;
const TOP_CATEGORIES = 3;
/** Used until the tooltip has been measured; keeps the first frame on-screen. */
const ASSUMED_SIZE = { width: 220, height: 130 };

export interface HoverTooltipProps {
  rollup: RollupResult;
  names: ReadonlyMap<string, string>;
  categories: readonly CrimeCategory[];
  delayMs?: number;
}

interface TopCategory {
  id: string;
  label: string;
  count: number;
  share: number;
}

export function HoverTooltip({
  rollup, names, categories, delayMs = SHOW_DELAY_MS,
}: HoverTooltipProps) {
  const strings = useStrings();
  const hover = useHoverTarget();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  const hoveredCode = hover?.code ?? null;

  // Show on a timer, hide immediately. Traversing a dense district map fires
  // dozens of enters per second; without the delay the tooltip strobes.
  useEffect(() => {
    if (hoveredCode === null) { setVisible(false); return; }

    const timer = setTimeout(() => { setVisible(true); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [hoveredCode, delayMs]);

  const detail = useMemo(() => {
    if (hoveredCode === null) return null;

    const name = names.get(hoveredCode) ?? hoveredCode;
    const aggregate = rollup.byRegion.get(hoveredCode);
    if (aggregate === undefined) {
      return { name, total: null, top: [] as readonly TopCategory[] };
    }

    const labels = new Map(categories.map((category) => [category.id, category.label]));
    const top: TopCategory[] = [...aggregate.byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIES)
      .map(([id, count]) => ({
        id,
        label: labels.get(id) ?? id,
        count,
        share: aggregate.total === 0 ? 0 : count / aggregate.total,
      }));

    return { name, total: aggregate.total, top };
  }, [hoveredCode, rollup, names, categories]);

  const placement = useMemo(() => {
    if (hover === null) return null;
    const size = ref.current === null
      ? ASSUMED_SIZE
      : { width: ref.current.offsetWidth, height: ref.current.offsetHeight };
    return placeTooltip(
      [hover.x, hover.y],
      size,
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, [hover]);

  const announcement = detail === null
    ? ''
    : `${detail.name}, ${
      detail.total === null ? strings.tooltip.noData : formatTrNumber(detail.total)
    }`;

  return (
    <>
      {/* Mirrors hover and focus targets for screen readers (§10). */}
      <div className="hm-visually-hidden" aria-live="polite">{announcement}</div>

      {visible && detail !== null && placement !== null ? (
        <div
          ref={ref}
          role="tooltip"
          className={styles.tooltip}
          style={{ transform: `translate(${placement.x}px, ${placement.y}px)` }}
        >
          <p className={styles.name}>{strings.tooltip.title(detail.name)}</p>

          {detail.total === null ? (
            <p className={styles.empty}>{strings.tooltip.noData}</p>
          ) : (
            <>
              <p className={styles.total}>
                <span className={styles.totalLabel}>{strings.tooltip.total}</span>
                <span className={styles.totalValue}>{formatTrNumber(detail.total)}</span>
              </p>

              {detail.top.length > 0 ? (
                <>
                  <p className={styles.section}>{strings.tooltip.topCategories}</p>
                  <ul className={styles.list}>
                    {detail.top.map((entry) => (
                      <li key={entry.id} className={styles.row}>
                        <span className={styles.rowLabel}>{entry.label}</span>
                        <span className={styles.rowValue}>
                          {formatTrNumber(entry.count)} ({formatPercent(entry.share)})
                        </span>
                        <span
                          className={styles.bar}
                          style={{ width: `${Math.round(entry.share * 100)}%` }}
                          aria-hidden="true"
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
