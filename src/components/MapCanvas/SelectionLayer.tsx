import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface SelectionLayerProps {
  features: readonly RenderFeature[];
  selectedCode: string | null;
  hoveredCode: string | null;
  focusedCode: string | null;
  /**
   * The province the reader has drilled into, once districts are the outlined
   * level. Null at country zoom, where the province borders are already drawn.
   */
  contextFeature?: RenderFeature | undefined;
}

/**
 * The boundary of the province being explored, drawn over its districts.
 *
 * Two strokes, not one. Zoomed in, the map is a mesh of district borders in the
 * same dark ink, and a single heavier line of the same colour just reads as one
 * of them that happens to be thicker. The pale casing underneath separates it
 * from that mesh — the standard cartographic answer to "which of these lines is
 * the administrative one".
 */
function ContextBoundary({ feature }: { feature: RenderFeature }) {
  return (
    <g data-role="context" data-code={feature.code}>
      <path
        d={feature.d}
        fill="none"
        stroke="var(--hm-glass-highlight)"
        strokeWidth={6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={feature.d}
        fill="none"
        stroke="var(--hm-fg)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
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
  features, selectedCode, hoveredCode, focusedCode, contextFeature,
}: SelectionLayerProps) {
  const find = (code: string | null): RenderFeature | undefined =>
    (code === null ? undefined : features.find((feature) => feature.code === code));

  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {/* First, so a hover or selection inside the province draws over it. */}
      {contextFeature === undefined ? null : <ContextBoundary feature={contextFeature} />}
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
