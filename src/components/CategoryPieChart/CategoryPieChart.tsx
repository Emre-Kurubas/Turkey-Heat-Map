import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { arcPath, categoryColor, collapseSlices, type Slice } from '@/core/chart/index.js';
import { formatPercent, formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory } from '@/core/types/index.js';
import { useStrings } from '@/hooks/useHeatMapState.js';
import styles from './CategoryPieChart.module.css';

/*
 * Sized to what a donut has to say, not to what the panel could spare.
 *
 * It was 132 across, which took a third of a 380px rail to draw eight arcs
 * whose only job is proportion — and the key beside it, which carries the
 * actual numbers, was the thing being squeezed for room. At 104 the arcs are
 * still comfortably readable and the rail is 40px narrower, all of it given
 * back to the map.
 */
const SIZE = 104;
const OUTER = 48;
const INNER = 28;
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
  /**
   * Defaults to true. Set false only where the same values are already listed
   * beside the chart — the detail panel puts a category table next to it, and
   * printing both is the same eight rows twice.
   *
   * The numbers must still be visible *somewhere*: three palette hues sit below
   * 3:1 on this surface, and their labels are what makes that legal.
   */
  showLegend?: boolean | undefined;
  /**
   * Renders as a section of a surrounding panel rather than as its own card:
   * no glass, no fixed width, and it fills the column it is given.
   */
  embedded?: boolean | undefined;
  /**
   * Where the key sits. `stack` (default) puts it under the donut; `beside`
   * puts it in a second column to the right.
   *
   * `beside` is the better use of a panel wider than the donut: stacked, the
   * key pushes everything below it down by eight rows while 200px sits empty
   * next to a 132px drawing.
   */
  legendPlacement?: 'stack' | 'beside' | undefined;
}

export function CategoryPieChart({
  categories, totals, regionName, onHoverCategory,
  showLegend = true, embedded = false, legendPlacement = 'stack',
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

  /*
   * How many key rows to hold room for: what this dataset could show, not what
   * this region happens to.
   *
   * A region with three categories drew a shorter key than one with eight, and
   * the band around it followed — so the panel was a different height for every
   * region. Reserving the dataset's own ceiling makes the drawing a constant
   * size, which is what lets the panel holding it be one too.
   */
  const keyRows = Math.min(categories.length, MAX_SLICES);

  return (
    <GlassPanel
      label={strings.pie.title}
      flat={embedded}
      className={embedded ? `${styles.panel} ${styles.embedded}` : styles.panel}
    >
      <h2 className={styles.title}>{strings.pie.title}</h2>
      {/* Only as a standalone card. Embedded, the surrounding panel has already
          said whose numbers these are — the rail is the national view by
          definition, and a region panel is titled with the region. */}
      {embedded ? null : (
        <span className={styles.scope}>{regionName ?? strings.pie.national}</span>
      )}

      {slices.length === 0 ? (
        <p className={styles.empty}>{strings.pie.empty}</p>
      ) : (
        /*
         * One wrapper whichever way the key sits, so the drawing and its key
         * never separate. The `beside` variant makes it a two-column grid;
         * `stack` leaves it a single column and it behaves as before.
         */
        <div
          className={legendPlacement === 'beside' ? `${styles.body} ${styles.beside}` : styles.body}
          data-role="pie-body"
          data-legend={legendPlacement}
        >
          {/* The legend carries every value, so the drawing itself adds nothing
              for a screen reader and would only add noise. */}
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

          {/* The key and the disclosure that opens it share a column, so the
              button stays under the rows it expands rather than under the
              donut. */}
          <div
            className={styles.keyColumn}
            style={showLegend ? { '--legend-rows': keyRows } as CSSProperties : undefined}
          >
            {showLegend ? (
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
            ) : null}

            {/*
              "Diğer" hides real categories, so it has to be openable (§7.7) —
              but only where the key it opens is on screen. Without the key it
              expanded arcs nobody could read a label off, and its coming and
              going with the data made the panel around it a different height
              from one region to the next.
            */}
            {showLegend && (hasOther || expanded) ? (
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
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
