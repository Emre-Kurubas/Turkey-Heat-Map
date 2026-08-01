import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface BorderLayerProps {
  features: readonly RenderFeature[];
  visible?: ReadonlySet<string>;
}

/**
 * Crisp region outlines.
 *
 * `vector-effect: non-scaling-stroke` keeps the stroke one pixel wide however
 * far the parent group is scaled. Without it a 0.75px border becomes 9px at
 * k=12 and the map turns into a mesh of white lines.
 */
export function BorderLayer({ features, visible }: BorderLayerProps) {
  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  return (
    <g
      aria-hidden="true"
      fill="none"
      stroke="var(--hm-border-stroke)"
      strokeWidth="var(--hm-border-width)"
      strokeLinejoin="round"
    >
      {drawn.map((feature) => (
        <path
          key={feature.code}
          data-code={feature.code}
          d={feature.d}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
