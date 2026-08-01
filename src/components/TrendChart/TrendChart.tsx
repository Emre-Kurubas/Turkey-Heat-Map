import { useMemo, useState } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import {
  areaPath, createLinearScale, linePath, niceMax, type Point,
} from '@/core/chart/index.js';
import { formatCompactTr, formatTrNumber } from '@/core/format/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './TrendChart.module.css';

const WIDTH = 236;
const HEIGHT = 84;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 16;
/** Markers are 3px; the hit target is far larger, per the interaction rules. */
const HIT_WIDTH = 22;

export interface TrendChartProps {
  byYear: ReadonlyMap<number, number>;
}

interface Plotted extends Point {
  year: number;
  value: number;
}

export function TrendChart({ byYear }: TrendChartProps) {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const yearRange = useHeatMapState((state) => state.filters.yearRange);
  const [activeStart, activeEnd] = yearRange;
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

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
      ? () => WIDTH / 2
      : createLinearScale([years[0]!, years[years.length - 1]!], [PAD_X, WIDTH - PAD_X]).toRange;
    const toY = createLinearScale([0, max], [HEIGHT - PAD_BOTTOM, PAD_TOP]).toRange;

    const points: Plotted[] = series.map(([year, value]) => ({
      x: toX(year), y: toY(value), year, value,
    }));
    return { points, max, baseline: HEIGHT - PAD_BOTTOM };
  }, [series]);

  const hoveredValue = hoveredYear === null ? null : byYear.get(hoveredYear) ?? null;
  const guide = plotted === null || hoveredYear === null
    ? null
    : plotted.points.find((point) => point.year === hoveredYear) ?? null;

  return (
    <GlassPanel label={strings.trend.title} className={styles.panel}>
      <h2 className={styles.title}>{strings.trend.title}</h2>

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
            <line
              className={styles.grid}
              x1={0}
              y1={plotted.baseline}
              x2={WIDTH}
              y2={plotted.baseline}
            />
            <path
              className={styles.area}
              data-role="area"
              d={areaPath(plotted.points, plotted.baseline)}
            />
            <path className={styles.line} data-role="line" d={linePath(plotted.points)} />

            {guide === null ? null : (
              <line
                className={styles.guide}
                data-role="guide"
                x1={guide.x}
                y1={PAD_TOP}
                x2={guide.x}
                y2={plotted.baseline}
              />
            )}

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
                cx={point.x}
                cy={point.y}
                r={point.year === hoveredYear ? 4 : 3}
              />
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
                height={HEIGHT}
                onPointerEnter={() => { setHoveredYear(point.year); }}
                onPointerLeave={() => { setHoveredYear(null); }}
                onClick={() => {
                  dispatch({ type: 'setYearRange', range: [point.year, point.year] });
                }}
              />
            ))}
          </svg>

          <div className={styles.readout}>
            {hoveredYear === null ? (
              <>
                <span>{plotted.points[0]?.year}</span>
                <span>{formatCompactTr(plotted.max)}</span>
              </>
            ) : (
              <>
                <span>{hoveredYear}</span>
                <span className={styles.readoutValue}>
                  {hoveredValue === null ? strings.trend.empty : formatTrNumber(hoveredValue)}
                </span>
              </>
            )}
          </div>

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
