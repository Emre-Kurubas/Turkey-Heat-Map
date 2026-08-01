import { useCallback } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { RangeSlider } from '@/components/primitives/RangeSlider.js';
import { formatYearRange } from '@/core/format/index.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './YearScope.module.css';

/**
 * The year range: stated and set, in the map's top right corner.
 *
 * It used to be a section of the filter panel, three clicks and a shut drawer
 * away from the reader. It is not that kind of filter. Category filters answer
 * "show me only these"; the year range decides what every number on screen is
 * counting, so it belongs where it can be read at a glance and moved without
 * opening anything.
 *
 * The panel is built around that reading: a quiet eyebrow, the range itself as
 * the largest thing on the card, then the control under it. The slider carries
 * its own scale, so nothing here repeats the bounds. The selected span is drawn
 * in the trend chart's own cyan — the two are about the same years, and the
 * shared colour is what says the line below is what this control is cutting.
 */
export function YearScope() {
  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const yearRange = useHeatMapState((state) => state.filters.yearRange);
  const yearBounds = useHeatMapState((state) => state.yearBounds);
  const [minYear, maxYear] = yearBounds;

  const onChange = useCallback((range: [number, number]) => {
    dispatch({ type: 'setYearRange', range });
  }, [dispatch]);

  // No `label` on the panel: the slider inside is already a group by that name,
  // and two nested groups sharing one name is that name announced twice.
  return (
    <GlassPanel className={styles.scope} data-role="year-scope">
      <p className={styles.caption}>
        <span className={styles.label}>{strings.filters.yearRange}</span>
        <span className={styles.value} data-role="year-value">
          {formatYearRange(yearRange)}
        </span>
      </p>

      <div className={styles.control}>
        <RangeSlider
          min={minYear}
          max={maxYear}
          value={yearRange}
          onChange={onChange}
          label={strings.filters.yearRange}
          formatValue={String}
          // The caption above is the readout. The slider's own would print the
          // same two years a second time, four pixels lower.
          showReadout={false}
          showTicks
        />
      </div>

    </GlassPanel>
  );
}
