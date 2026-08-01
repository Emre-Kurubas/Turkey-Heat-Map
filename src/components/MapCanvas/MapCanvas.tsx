import { useCallback, useId, useMemo } from 'react';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { CrimeCategory, CrimeRecord, Viewport } from '@/core/types/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { useHeatMapDispatch, useHeatMapState, useStrings } from '@/hooks/useHeatMapState.js';
import { useHoverTarget } from '@/hooks/useHoverTarget.js';
import { useMapGeometry } from '@/hooks/useMapGeometry.js';
import { useMapZoom } from '@/hooks/useMapZoom.js';
import { useResizeObserver } from '@/hooks/useResizeObserver.js';
import { BorderLayer } from './BorderLayer.js';
import { HeatLayer, type HeatStyle } from './HeatLayer.js';
import { HitLayer } from './HitLayer.js';
import { MapDefs } from './MapDefs.js';
import { SelectionLayer } from './SelectionLayer.js';
import styles from './MapCanvas.module.css';

/** Blur radius at k=1, in projected pixels. */
const BASE_BLUR = 12;

export interface RegionClickPayload {
  code: string;
  name: string;
  value: number | null;
}

export interface MapCanvasProps {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  colorScale: ColorScaleName | RampFn;
  heatStyle: HeatStyle;
  onRegionClick?: (region: RegionClickPayload) => void;
  /** Test-only size override; jsdom reports every element as 0x0. */
  testViewport?: Viewport;
}

export function MapCanvas({
  data, categories, colorScale, heatStyle, onRegionClick, testViewport,
}: MapCanvasProps) {
  const [containerRef, measured] = useResizeObserver<HTMLDivElement>();
  const viewport = testViewport ?? measured;

  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const idPrefix = useId().replace(/:/gu, '');

  const { transform, level, handlers, svgRef } = useMapZoom(viewport);
  const geometry = useMapGeometry(viewport, level, transform);
  const { rollup, scale, names } = useAggregates({ data, categories, colorScale });

  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const focusedCode = useHeatMapState((state) => state.focusedCode);
  const hover = useHoverTarget();

  const values = useMemo(() => {
    const out = new Map<string, number>();
    for (const [code, aggregate] of rollup.byRegion) out.set(code, aggregate.total);
    return out;
  }, [rollup]);

  // The union of every region is the clip for the heat bleed. Concatenating the
  // path data is enough — SVG treats it as one shape under the default fill rule.
  const outlinePath = useMemo(
    () => geometry.features.map((feature) => feature.d).join(' '),
    [geometry.features],
  );

  const onSelect = useCallback((code: string | null) => {
    dispatch({ type: 'select', code });
    if (code === null || onRegionClick === undefined) return;
    onRegionClick({
      code,
      name: names.get(code) ?? code,
      value: values.get(code) ?? null,
    });
  }, [dispatch, onRegionClick, names, values]);

  const onFocusRegion = useCallback((code: string) => {
    dispatch({ type: 'focus', code });
  }, [dispatch]);

  return (
    <div ref={containerRef} className={styles.container}>
      {!geometry.ready ? (
        <p className={styles.loading}>{strings.map.loading}</p>
      ) : (
        <svg
          ref={svgRef}
          className={styles.svg}
          role="application"
          aria-label={strings.map.label}
          width={viewport.width}
          height={viewport.height}
          {...handlers}
        >
          <MapDefs
            idPrefix={idPrefix}
            // Perceived softness must stay constant across zoom, so the radius
            // shrinks as the group scales up (§6.3).
            blurStdDeviation={BASE_BLUR / transform.k}
            outlinePath={outlinePath}
          />
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <HeatLayer
              features={geometry.features}
              values={values}
              scale={scale}
              idPrefix={idPrefix}
              heatStyle={heatStyle}
              visible={geometry.visible}
            />
            <BorderLayer features={geometry.features} visible={geometry.visible} />
            <HitLayer
              features={geometry.features}
              values={values}
              visible={geometry.visible}
              selectedCode={selectedCode}
              focusedCode={focusedCode}
              onSelect={onSelect}
              onFocusRegion={onFocusRegion}
              formatValue={formatTrNumber}
            />
            <SelectionLayer
              features={geometry.features}
              selectedCode={selectedCode}
              hoveredCode={hover?.code ?? null}
              focusedCode={focusedCode}
            />
          </g>
        </svg>
      )}
    </div>
  );
}
