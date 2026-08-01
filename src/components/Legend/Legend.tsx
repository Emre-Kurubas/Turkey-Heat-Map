import { useMemo } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel.js';
import { computeLegendBreaks, type ColorScale } from '@/core/color/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import { useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import styles from './Legend.module.css';

const DEFAULT_BREAKS = 6;

/**
 * Samples used to build the gradient bar.
 *
 * The ramp is continuous, so the key has to be too. Six discrete swatches
 * implied the map only had six colours, which is the opposite of what it does.
 *
 * Every sample is the ramp's own output at that position rather than something
 * the browser interpolated: CSS gradients blend in sRGB, and this ramp is built
 * in OKLab. Sampling it densely enough is what keeps the bar showing the same
 * colours the map is actually painted with.
 */
const GRADIENT_SAMPLES = 64;

export interface LegendProps {
  scale: ColorScale;
  breakCount?: number;
}

/**
 * The colour key.
 *
 * Always states the active scale mode, because a quantile map answers "how does
 * this rank" while a linear map answers "how many", and reading one as the
 * other is a real analytical error. Numbers sit along the bar for the
 * same reason: colour is the summary, the number is the source of truth.
 */
export function Legend({ scale, breakCount = DEFAULT_BREAKS }: LegendProps) {
  const strings = useStrings();
  const scaleMode = useHeatMapState((state) => state.scaleMode);

  const breaks = useMemo(
    () => computeLegendBreaks(scale, breakCount),
    [scale, breakCount],
  );

  const gradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i < GRADIENT_SAMPLES; i += 1) {
      const t = i / (GRADIENT_SAMPLES - 1);
      stops.push(`${scale.ramp(t)} ${(t * 100).toFixed(2)}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [scale]);

  // An empty dataset collapses the domain to [0, 0]. That is "nothing to show",
  // not a one-bucket scale, and saying so beats rendering a lone zero swatch.
  const hasData = scale.domain.min !== scale.domain.max || scale.domain.max !== 0;

  /*
   * Ticks reuse the break boundaries rather than dividing the bar evenly, so a
   * number sits above the colour it actually names. Under a quantile domain
   * those are very different positions: the top bucket can cover most of the
   * value range while occupying a seventh of the bar.
   */
  const ticks = useMemo(() => {
    if (breaks.length === 0) return [];
    const values = [breaks[0]!.from, ...breaks.map((entry) => entry.to)];
    return values.map((value, index) => ({
      value,
      percent: scale.domain.toT(value) * 100,
      key: `${index}-${value}`,
    }));
  }, [breaks, scale]);

  const lastTick = ticks.length - 1;

  return (
    <GlassPanel label={strings.legend.title} className={styles.legend}>
      <h2 className={styles.title}>{strings.legend.title}</h2>

      {hasData ? (
        <div className={styles.ramp}>
          <div className={styles.bar} data-role="ramp" style={{ background: gradient }} />
          <div className={styles.ticks}>
            {ticks.map((tick, index) => (
              <span
                key={tick.key}
                className={styles.tick}
                data-role="tick"
                style={{
                  left: `${tick.percent}%`,
                  // The end labels would otherwise hang off the bar.
                  transform: index === 0
                    ? 'none'
                    : index === lastTick ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {formatTrNumber(tick.value)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.empty}>{strings.legend.noData}</p>
      )}

      {/*
        The mode, and nothing else.

        The sentence that followed it explained how to read a colour ramp, which
        is a thing you learn once and then re-read every time it is on screen.
        The mode itself stays: a quantile map answers "how does this rank" and a
        linear one answers "how many", and reading one as the other is a real
        analytical error — so which is active is a fact, not a caption.
      */}
      <p className={styles.note}>{strings.scaleMode[scaleMode]}</p>
    </GlassPanel>
  );
}
