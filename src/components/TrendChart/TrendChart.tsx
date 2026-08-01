import { useCallback, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import {
  createLinearScale, linePath, niceMax, type Point,
} from '@/core/chart/index.js';
import { formatCompactTr, formatTrNumber } from '@/core/format/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './TrendChart.module.css';

/*
 * A drawn chart with two labelled axes, not a sparkline.
 *
 * The old 236×84 strip had no scale on it at all: the line's shape was
 * readable but no point on it could be named without hovering. Axes cost
 * vertical space and give back the ability to read a value straight off the
 * page, which is the whole reason a year series is on screen.
 */
/*
 * 340 is what both places that hold this chart can give it: the left rail is
 * 380 wide and the region detail panel 380, each with 12–16px of padding a
 * side. Sizing to the smaller of the two means one drawing serves both.
 */
const WIDTH = 340;
/*
 * Sized to the ink, not padded past it.
 *
 * The y arrow's tip is at y=0 and the lowest ink is the baseline of the rotated
 * year labels, a few pixels under their anchor. Anything beyond that is dead
 * space inside the box — and dead space at one end only is what makes a chart
 * sit off-centre between the rules above and below its band, however evenly
 * that band is padded.
 */
const HEIGHT = 168;
/** Room for the y tick labels. */
const PAD_LEFT = 38;
/** Room for the axis arrowhead to overhang the last point. */
const PAD_RIGHT = 16;
const PAD_TOP = 14;
/** Room for the rotated year labels underneath. */
const PAD_BOTTOM = 26;

const PLOT_RIGHT = WIDTH - PAD_RIGHT;
const BASELINE = HEIGHT - PAD_BOTTOM;

/** Horizontal gridlines below the top one, so five ticks in total. */
const Y_DIVISIONS = 4;
/** Markers are small; the hit target is far larger, per the interaction rules. */
const HIT_WIDTH = 22;
/** Above this many years the labels would overlap, so only every nth is drawn. */
const MAX_X_LABELS = 10;

export interface TrendChartProps {
  byYear: ReadonlyMap<number, number>;
  /**
   * Renders as a section of a surrounding panel rather than as its own card:
   * no glass and no card padding. The drawing keeps its size either way — an
   * SVG this dense does not survive being scaled down.
   */
  embedded?: boolean | undefined;
}

interface Plotted extends Point {
  year: number;
  value: number;
}

export function TrendChart({ byYear, embedded = false }: TrendChartProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const yearRange = useHeatMapState((state) => state.filters.yearRange);
  const yearBounds = useHeatMapState((state) => state.yearBounds);
  const [activeStart, activeEnd] = yearRange;
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  /*
   * A click picks a year; a second click on the same year gives them all back.
   *
   * Without the toggle, narrowing to 2020 is a one-way door: the only control
   * that widens the range again is the slider over the map, and nothing on the
   * chart says so. The series itself always spans every year — see
   * `totalsByYear` — so the other points stay on screen and stay clickable
   * while one of them is selected.
   */
  const isolated = activeStart === activeEnd;
  const pick = useCallback((year: number) => {
    dispatch({
      type: 'setYearRange',
      range: isolated && activeStart === year ? yearBounds : [year, year],
    });
  }, [dispatch, isolated, activeStart, yearBounds]);

  const series = useMemo(
    () => [...byYear.entries()].sort((a, b) => a[0] - b[0]),
    [byYear],
  );

  const plotted = useMemo(() => {
    if (series.length === 0) return null;

    const years = series.map(([year]) => year);
    const max = niceMax(Math.max(...series.map(([, value]) => value)));

    // A single-year dataset has a zero-width domain; createLinearScale maps it
    // to the range start rather than dividing by zero, so centre it instead of
    // pinning it to the left edge.
    const toX = series.length === 1
      ? () => (PAD_LEFT + PLOT_RIGHT) / 2
      : createLinearScale(
        [years[0]!, years[years.length - 1]!],
        [PAD_LEFT, PLOT_RIGHT],
      ).toRange;
    const toY = createLinearScale([0, max], [BASELINE, PAD_TOP]).toRange;

    const points: Plotted[] = series.map(([year, value]) => ({
      x: toX(year), y: toY(value), year, value,
    }));

    /*
     * A label is dropped when it would repeat the one below it.
     *
     * Quartering a small maximum gives fractional ticks, and the formatter
     * rounds: a max of 4 would label its five gridlines 0, 1, 2, 3, 4, but a max
     * of 1 would label them 0, 0, 1, 1, 1. The gridline stays either way — the
     * grid is the reference, the number is the annotation.
     */
    let lastLabel = '';
    const yTicks = Array.from({ length: Y_DIVISIONS + 1 }, (_, index) => {
      const value = (max / Y_DIVISIONS) * index;
      const label = formatCompactTr(value);
      const repeated = index > 0 && label === lastLabel;
      lastLabel = label;
      return { y: toY(value), label: repeated ? null : label };
    });

    // Every year gets a gridline; only every nth gets a label, so a twenty-year
    // series thins its labels rather than overprinting them.
    const stride = Math.ceil(points.length / MAX_X_LABELS);

    return { points, max, yTicks, stride };
  }, [series]);

  const hoveredValue = hoveredYear === null ? null : byYear.get(hoveredYear) ?? null;
  const guide = plotted === null || hoveredYear === null
    ? null
    : plotted.points.find((point) => point.year === hoveredYear) ?? null;

  return (
    <GlassPanel
      label={strings.trend.title}
      flat={embedded}
      className={embedded ? `${styles.panel} ${styles.embedded}` : styles.panel}
    >
      {/*
        Embedded, the drawing is its own caption: an axis of years and a line
        over it needs no heading to say it is a series over years, and the
        panel around it already has a title. The accessible name stays on the
        group either way, so nothing is lost to a screen reader.
      */}
      {embedded ? null : <h2 className={styles.title}>{strings.trend.title}</h2>}

      {plotted === null ? (
        <p className={styles.empty}>{strings.trend.empty}</p>
      ) : (
        <>
          <svg
            className={styles.chart}
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            aria-hidden="true"
          >
            {plotted.yTicks.map((tick, index) => (
              // Keyed by position on the axis, which is what the tick *is*:
              // two ticks can share a rounded label but never a slot.
              <g key={index}>
                <line
                  className={styles.grid}
                  data-role="grid"
                  x1={PAD_LEFT}
                  y1={tick.y}
                  x2={PLOT_RIGHT}
                  y2={tick.y}
                />
                {tick.label === null ? null : (
                  <text
                    className={styles.yLabel}
                    data-role="y-label"
                    x={PAD_LEFT - 8}
                    y={tick.y}
                  >
                    {tick.label}
                  </text>
                )}
              </g>
            ))}

            {plotted.points.map((point) => (
              <line
                key={point.year}
                className={styles.grid}
                data-role="grid"
                x1={point.x}
                y1={PAD_TOP}
                x2={point.x}
                y2={BASELINE}
              />
            ))}

            {/*
              Axes last of the static layers, so the grid meets them rather than
              crossing over them. The arrowheads are drawn as plain triangles
              instead of SVG markers: a marker needs a document-unique id, and
              two charts are on screen at once whenever a region panel is open.
            */}
            <line
              className={styles.axis}
              data-role="axis-x"
              x1={PAD_LEFT}
              y1={BASELINE}
              x2={WIDTH - 8}
              y2={BASELINE}
            />
            <path className={styles.arrow} d={`M${WIDTH} ${BASELINE} l-10 -5 v10 Z`} />
            <line
              className={styles.axis}
              data-role="axis-y"
              x1={PAD_LEFT}
              y1={BASELINE}
              x2={PAD_LEFT}
              y2={8}
            />
            <path className={styles.arrow} d={`M${PAD_LEFT} 0 l-5 10 h10 Z`} />

            {guide === null ? null : (
              <line
                className={styles.guide}
                data-role="guide"
                x1={guide.x}
                y1={PAD_TOP}
                x2={guide.x}
                y2={BASELINE}
              />
            )}

            <path className={styles.line} data-role="line" d={linePath(plotted.points)} />

            {plotted.points.map((point) => (
              <circle
                key={point.year}
                className={styles.marker}
                data-role="marker"
                // The active filter range stays bright; the rest dims, so the
                // selection is always visible in context (§7.7).
                data-active={
                  point.year >= activeStart && point.year <= activeEnd ? 'true' : 'false'
                }
                // The one year a click has isolated, so the reader can see what
                // they picked without reading it off the top-right caption.
                data-selected={isolated && point.year === activeStart ? 'true' : 'false'}
                cx={point.x}
                cy={point.y}
                r={point.year === hoveredYear ? 6 : 4.5}
              />
            ))}

            {/*
              The hovered value, drawn on the chart rather than in a row beneath
              it. A reserved row is empty most of the time and its height counts
              against the band, which pushed the drawing up against the rule
              above it. Stroked underneath so it stays legible over the grid.
            */}
            {guide === null || hoveredValue === null ? null : (
              <text
                className={styles.callout}
                data-role="callout"
                x={guide.x}
                y={guide.y - 12}
                // Flipped to the inside near either end, so the label never
                // hangs off the edge of the drawing.
                textAnchor={
                  guide.x > PLOT_RIGHT - 40 ? 'end' : guide.x < PAD_LEFT + 40 ? 'start' : 'middle'
                }
              >
                {formatTrNumber(hoveredValue)}
              </text>
            )}

            {plotted.points.map((point, index) => (
              index % plotted.stride === 0 ? (
                <text
                  key={point.year}
                  className={styles.xLabel}
                  data-role="x-label"
                  // Rotated about the tick it names, so the label's right end
                  // stays under its own point however long the text is.
                  transform={`rotate(-45 ${point.x} ${BASELINE + 14})`}
                  x={point.x}
                  y={BASELINE + 14}
                >
                  {point.year}
                </text>
              ) : null
            ))}

            {plotted.points.map((point) => (
              <rect
                key={point.year}
                className={styles.hit}
                data-role="hit"
                data-year={point.year}
                x={point.x - HIT_WIDTH / 2}
                y={0}
                width={HIT_WIDTH}
                height={BASELINE}
                onPointerEnter={() => { setHoveredYear(point.year); }}
                onPointerLeave={() => { setHoveredYear(null); }}
                onClick={() => { pick(point.year); }}
              />
            ))}
          </svg>


          {/* The drawing is aria-hidden, so the series is exposed as a table —
              the accessible equivalent of the chart, not a duplicate of it. */}
          <table className="hm-visually-hidden">
            <caption>{strings.trend.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.trend.year}</th>
                <th scope="col">{strings.tooltip.total}</th>
              </tr>
            </thead>
            <tbody>
              {series.map(([year, value]) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  <td>{formatTrNumber(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </GlassPanel>
  );
}
