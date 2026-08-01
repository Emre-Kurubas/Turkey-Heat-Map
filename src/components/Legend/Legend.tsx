import { useMemo } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { computeLegendBreaks, type ColorScale } from '@/core/color/index.js';
import { useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './Legend.module.css';

const DEFAULT_BREAKS = 6;

export interface LegendProps {
  scale: ColorScale;
  breakCount?: number;
}

/**
 * The colour key.
 *
 * Always states the active scale mode, because a quantile map answers "how does
 * this rank" while a linear map answers "how many", and reading one as the
 * other is a real analytical error (§6.5). Numbers sit beside every swatch for
 * the same reason: no rainbow ramp is fully colourblind-safe, so colour is the
 * summary and the number is the source of truth.
 */
export function Legend({ scale, breakCount = DEFAULT_BREAKS }: LegendProps) {
  const strings = useStrings();
  const scaleMode = useHeatMapState((state) => state.scaleMode);

  const breaks = useMemo(
    () => computeLegendBreaks(scale, breakCount),
    [scale, breakCount],
  );

  // An empty dataset collapses the domain to [0, 0]. That is "nothing to show",
  // not a one-bucket scale, and saying so beats rendering a lone zero swatch.
  const hasData = scale.domain.min !== scale.domain.max || scale.domain.max !== 0;

  return (
    <GlassPanel label={strings.legend.title} className={styles.legend}>
      <h2 className={styles.title}>{strings.legend.title}</h2>

      {hasData ? (
        <ul className={styles.list}>
          {breaks.map((entry) => (
            <li key={`${entry.from}-${entry.to}`} className={styles.item} data-role="swatch">
              <span
                className={styles.chip}
                data-role="chip"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span className={styles.label}>{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{strings.legend.noData}</p>
      )}

      <p className={styles.note}>
        {strings.scaleMode[scaleMode]} · {strings.legend.scaleNote}
      </p>
    </GlassPanel>
  );
}
