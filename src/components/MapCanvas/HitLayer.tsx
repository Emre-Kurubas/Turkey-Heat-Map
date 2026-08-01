import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useStrings } from '@/hooks/useHeatMapState.js';
import { useSetHoverTarget } from '@/hooks/useHoverTarget.js';
import type { RenderFeature } from '@/hooks/useMapGeometry.js';

export interface HitLayerProps {
  features: readonly RenderFeature[];
  values: ReadonlyMap<string, number>;
  visible?: ReadonlySet<string>;
  selectedCode: string | null;
  focusedCode: string | null;
  onSelect: (code: string | null) => void;
  onFocusRegion: (code: string) => void;
  formatValue: (value: number) => string;
}

/**
 * Transparent interaction surface.
 *
 * Separate from the visible fills for two reasons. The heat layer is blurred,
 * so hit-testing it would be inaccurate by exactly the blur radius; and the
 * fills are re-coloured on every filter change, while this layer's DOM is
 * stable. Every region is a focusable `role="img"` with a name-and-value label,
 * which is what makes the map usable without sight or a pointer (§10).
 */
export function HitLayer({
  features, values, visible, selectedCode, focusedCode,
  onSelect, onFocusRegion, formatValue,
}: HitLayerProps) {
  const setHover = useSetHoverTarget();
  const strings = useStrings();

  const drawn = visible === undefined
    ? features
    : features.filter((feature) => visible.has(feature.code));

  // Exactly one region carries tabindex=0 so the map is a single tab stop;
  // arrow keys move within it. A tab stop per region would mean 973 of them.
  const tabbableCode = focusedCode ?? drawn[0]?.code ?? null;

  const onKeyDown = useCallback((event: ReactKeyboardEvent<SVGPathElement>, code: string) => {
    const index = drawn.findIndex((feature) => feature.code === code);

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(code);
        return;
      case 'Escape':
        event.preventDefault();
        onSelect(null);
        return;
      case 'ArrowRight':
      case 'ArrowDown': {
        const next = drawn[index + 1];
        if (next !== undefined) { event.preventDefault(); onFocusRegion(next.code); }
        return;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        const prev = drawn[index - 1];
        if (prev !== undefined) { event.preventDefault(); onFocusRegion(prev.code); }
        return;
      }
      default:
    }
  }, [drawn, onSelect, onFocusRegion]);

  const onPointerEnter = useCallback((
    event: ReactPointerEvent<SVGPathElement>,
    code: string,
  ) => {
    setHover({ type: 'enter', target: { code, x: event.clientX, y: event.clientY } });
  }, [setHover]);

  return (
    <g>
      {drawn.map((feature) => {
        const value = values.get(feature.code);
        const label = `${feature.name}: ${
          value === undefined ? strings.tooltip.noData : formatValue(value)
        }`;

        return (
          <path
            key={feature.code}
            data-code={feature.code}
            d={feature.d}
            fill="transparent"
            role="img"
            aria-label={label}
            tabIndex={feature.code === tabbableCode ? 0 : -1}
            {...(feature.code === selectedCode ? { 'aria-current': true as const } : {})}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerEnter={(event) => { onPointerEnter(event, feature.code); }}
            onPointerMove={(event) => {
              setHover({ type: 'move', x: event.clientX, y: event.clientY });
            }}
            onPointerLeave={() => { setHover({ type: 'leave' }); }}
            onClick={() => { onSelect(feature.code); }}
            onFocus={() => { onFocusRegion(feature.code); }}
            onKeyDown={(event) => { onKeyDown(event, feature.code); }}
          />
        );
      })}
    </g>
  );
}
