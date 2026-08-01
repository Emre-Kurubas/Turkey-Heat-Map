import type { ColorScale } from '@/core/color/index.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export type HeatStyle = 'glow' | 'flat';

export interface HeatLayerProps {
  features: readonly RenderFeature[];
  /** Region code → value for the active filters. Missing means no data. */
  values: ReadonlyMap<string, number>;
  scale: ColorScale;
  idPrefix: string;
  heatStyle: HeatStyle;
  /** Codes to draw. Omit to draw everything. */
  visible?: ReadonlySet<string>;
}

/**
 * The blurred fills.
 *
 * A region with no data is painted in the neutral no-data fill rather than the
 * scale's zero colour: "no records" and "zero crimes" are different claims, and
 * colouring them identically would assert the stronger one.
 */
export function HeatLayer({
  features, values, scale, idPrefix, heatStyle, visible,
}: HeatLayerProps) {
  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  return (
    <g
      // Pointer events and semantics belong to HitLayer, which is unblurred and
      // therefore pixel-accurate against the true boundaries.
      aria-hidden="true"
      clipPath={`url(#${idPrefix}-outline)`}
      {...(heatStyle === 'glow' ? { filter: `url(#${idPrefix}-blur)` } : {})}
    >
      {drawn.map((feature) => {
        const value = values.get(feature.code);
        return (
          <path
            key={feature.code}
            data-code={feature.code}
            d={feature.d}
            fill={value === undefined ? 'var(--hm-no-data)' : scale(value)}
          />
        );
      })}
    </g>
  );
}
