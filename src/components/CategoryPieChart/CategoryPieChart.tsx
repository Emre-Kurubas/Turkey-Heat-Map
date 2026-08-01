import { useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { arcPath, categoryColor, collapseSlices, type Slice } from '@/core/chart/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './CategoryPieChart.module.css';

const SIZE = 132;
const OUTER = 62;
const INNER = 38;
const MIN_SHARE = 0.03;
/**
 * The palette ceiling, not a readability limit.
 *
 * A tighter cap looked right on paper and was wrong on screen. Türkiye's crime
 * categories are near-equal, so capping at six folded three of eight into a
 * `Diğer` worth 36% — larger than every real category and meaning nothing. A
 * fold is only an improvement when the tail it hides is genuinely small, which
 * is what the 3% floor already decides.
 *
 * Eight is safe rather than arbitrary: the categorical palette was validated on
 * its *adjacent* pairs, which is exactly what a donut asks a reader to compare.
 */
const MAX_SLICES = 8;
/** A 2px gap keeps neighbouring arcs from bleeding into one another. */
const GAP_RADIANS = 2 / OUTER;

export interface CategoryPieChartProps {
  categories: readonly CrimeCategory[];
  totals: ReadonlyMap<string, number>;
  /** Selected region, or null for the national picture. */
  regionName: string | null;
  onHoverCategory: (id: string | null) => void;
}

export function CategoryPieChart({
  categories, totals, regionName, onHoverCategory,
}: CategoryPieChartProps) {
  const strings = useStrings();
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Slot by position in the dataset's own list, so a category keeps its colour
  // when filtering changes which categories are present.
  const colorById = useMemo(() => new Map(
    categories.map((category, index) => [
      category.id,
      category.color ?? categoryColor(index),
    ]),
  ), [categories]);

  const slices = useMemo(() => {
    const raw: Slice[] = categories.map((category) => ({
      id: category.id,
      label: category.label,
      value: totals.get(category.id) ?? 0,
    }));
    return collapseSlices(raw, {
      // Expanding lifts both limits at once. Lifting only the count cap would
      // still hide sub-3% slivers, so the disclosure would not disclose them.
      minShare: expanded ? 0 : MIN_SHARE,
      maxSlices: expanded ? Number.POSITIVE_INFINITY : MAX_SLICES,
      otherLabel: strings.pie.other,
    });
  }, [categories, totals, expanded, strings.pie.other]);

  const hasOther = slices.some((slice) => slice.isOther);

  const arcs = useMemo(() => {
    let angle = 0;
    return slices.map((slice) => {
      const sweep = slice.share * Math.PI * 2;
      const start = angle;
      angle += sweep;
      return {
        slice,
        // Trim the gap off the end so slices never touch. Guarded so a sliver
        // narrower than the gap does not invert into a negative sweep.
        d: arcPath({
          cx: SIZE / 2,
          cy: SIZE / 2,
          innerRadius: INNER,
          outerRadius: OUTER,
          startAngle: start,
          endAngle: Math.max(start, start + sweep - GAP_RADIANS),
        }),
      };
    });
  }, [slices]);

  const setHover = (id: string | null): void => {
    setHovered(id);
    onHoverCategory(id);
  };

  return (
    <GlassPanel label={strings.pie.title} className={styles.panel}>
      <h2 className={styles.title}>{strings.pie.title}</h2>
      <span className={styles.scope}>{regionName ?? strings.pie.national}</span>

      {slices.length === 0 ? (
        <p className={styles.empty}>{strings.pie.empty}</p>
      ) : (
        <>
          {/* The legend below carries every value, so the drawing itself adds
              nothing for a screen reader and would only add noise. */}
          <svg
            className={styles.chart}
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            aria-hidden="true"
          >
            {arcs.map(({ slice, d }) => (
              <path
                key={slice.id}
                d={d}
                data-slice={slice.id}
                data-dimmed={hovered !== null && hovered !== slice.id ? 'true' : 'false'}
                className={styles.slice}
                fill={slice.isOther ? 'var(--hm-fg-muted)' : colorById.get(slice.id)}
                onPointerEnter={() => { setHover(slice.id); }}
                onPointerLeave={() => { setHover(null); }}
              />
            ))}
          </svg>

          <ul className={styles.legend}>
            {slices.map((slice) => (
              <li key={slice.id} className={styles.item}>
                <span
                  className={styles.swatch}
                  style={{
                    background: slice.isOther
                      ? 'var(--hm-fg-muted)'
                      : colorById.get(slice.id),
                  }}
                  aria-hidden="true"
                />
                <span className={styles.label}>{slice.label}</span>
                <span className={styles.value}>{formatTrNumber(slice.value)}</span>
                <span className={styles.share}>{formatPercent(slice.share)}</span>
              </li>
            ))}
          </ul>

          {/* "Diğer" hides real categories, so it has to be openable (§7.7). */}
          {hasOther || expanded ? (
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={expanded}
              onClick={() => { setExpanded((v) => !v); }}
            >
              {expanded
                ? strings.pie.collapse
                : `${strings.pie.other} · ${strings.pie.expand}`}
            </button>
          ) : null}
        </>
      )}
    </GlassPanel>
  );
}
