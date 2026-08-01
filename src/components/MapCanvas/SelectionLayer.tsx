import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface SelectionLayerProps {
  features: readonly RenderFeature[];
  selectedCode: string | null;
  hoveredCode: string | null;
  focusedCode: string | null;
}

interface HighlightProps {
  feature: RenderFeature | undefined;
  role: 'hover' | 'selected' | 'focus';
  stroke: string;
  width: number;
  dashed?: boolean;
}

function Highlight({ feature, role, stroke, width, dashed }: HighlightProps) {
  if (feature === undefined) return null;
  return (
    <path
      data-role={role}
      data-code={feature.code}
      d={feature.d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      vectorEffect="non-scaling-stroke"
      {...(dashed === true ? { strokeDasharray: '4 3' } : {})}
    />
  );
}

/**
 * Highlights, drawn above every other layer.
 *
 * Kept separate from BorderLayer because it re-renders on pointer movement
 * while the borders do not — and because a highlight must never be blurred or
 * clipped by the country outline the way the heat fills are.
 */
export function SelectionLayer({
  features, selectedCode, hoveredCode, focusedCode,
}: SelectionLayerProps) {
  const find = (code: string | null): RenderFeature | undefined =>
    (code === null ? undefined : features.find((feature) => feature.code === code));

  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <Highlight feature={find(hoveredCode)} role="hover" stroke="var(--hm-fg)" width={1.5} />
      <Highlight feature={find(selectedCode)} role="selected" stroke="var(--hm-fg)" width={2.5} />
      <Highlight
        feature={find(focusedCode)}
        role="focus"
        stroke="var(--hm-focus-ring)"
        width={3}
        dashed
      />
    </g>
  );
}
