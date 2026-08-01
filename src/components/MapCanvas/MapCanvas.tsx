import { useCallback, useEffect, useId, useMemo } from 'react';
import type { RollupResult } from '@/core/aggregation/index.js';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { MapFit } from '@/core/geo/index.js';
import type { CrimeCategory, CrimeRecord, Viewport } from '@/core/types/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { useFlyTo } from '@/hooks/useFlyTo.js';
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

/** Region code → total, the shape both the fills and the labels read. */
function totalsOf(result: RollupResult): Map<string, number> {
  const out = new Map<string, number>();
  for (const [code, aggregate] of result.byRegion) out.set(code, aggregate.total);
  return out;
}

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
  fit?: MapFit | undefined;
  /** Test-only size override; jsdom reports every element as 0x0. */
  testViewport?: Viewport;
}

export function MapCanvas({
  data, categories, colorScale, heatStyle, onRegionClick, fit, testViewport,
}: MapCanvasProps) {
  const [containerRef, measured] = useResizeObserver<HTMLDivElement>();
  const viewport = testViewport ?? measured;

  const strings = useStrings();
  const dispatch = useHeatMapDispatch();
  const idPrefix = useId().replace(/:/gu, '');

  const { transform, level, handlers, svgRef } = useMapZoom(viewport);
  const { rollup, heatRollup, scale, heatLevel, names } = useAggregates({
    data, categories, colorScale,
  });
  const geometry = useMapGeometry(viewport, level, heatLevel, transform, fit);

  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const focusedCode = useHeatMapState((state) => state.focusedCode);
  const hover = useHoverTarget();

  /** Values for the outlined level — what the tooltip and aria labels report. */
  const values = useMemo(() => totalsOf(rollup), [rollup]);
  /** Values for the painted level — always district resolution. */
  const heatValues = useMemo(() => totalsOf(heatRollup), [heatRollup]);

  // The union of every province is the clip for the heat bleed. Provinces are
  // used regardless of the outlined level: they tile the same country with far
  // fewer path segments than the districts do.
  const clipPath = useMemo(
    () => geometry.outline.map((feature) => feature.d).join(' '),
    [geometry.outline],
  );

  const onSelect = useCallback((code: string | null) => {
    if (code === null) {
      dispatch({ type: 'select', code: null });
      dispatch({ type: 'closeDetail' });
      return;
    }

    dispatch({ type: 'openDetail', code, level });

    // A province click also zooms in. Fitting even the largest province to the
    // viewport lands well past the 2.65 district threshold, so the level
    // switches on its own — the detail target carries its own level precisely
    // so that switch does not close the panel this click just opened.
    if (level === 'il') dispatch({ type: 'requestFlyTo', code });

    if (onRegionClick === undefined) return;
    onRegionClick({
      code,
      name: names.get(code) ?? code,
      value: values.get(code) ?? null,
    });
  }, [dispatch, level, onRegionClick, names, values]);

  const onFocusRegion = useCallback((code: string) => {
    dispatch({ type: 'focus', code });
  }, [dispatch]);

  // Panels ask for a fly-to through the store rather than reaching into the
  // map, which is what lets the sidebar and search bar move it without
  // importing it. The request is cleared immediately so the same region can be
  // requested again.
  const flyTo = useFlyTo(viewport);
  const flyToRequest = useHeatMapState((state) => state.flyToRequest);

  useEffect(() => {
    if (flyToRequest === null) return;

    const bbox = geometry.bounds.get(flyToRequest);
    if (bbox !== undefined) flyTo(bbox);
    dispatch({ type: 'clearFlyTo' });
  }, [flyToRequest, geometry.bounds, flyTo, dispatch]);

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
            outlinePath={clipPath}
          />
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Painted at district resolution whatever the zoom, so the heat
                keeps its detail while the borders above it coarsen. */}
            <HeatLayer
              features={geometry.heat}
              values={heatValues}
              scale={scale}
              idPrefix={idPrefix}
              heatStyle={heatStyle}
              visible={geometry.visibleHeat}
            />
            <BorderLayer features={geometry.outline} visible={geometry.visibleOutline} />
            <HitLayer
              features={geometry.outline}
              values={values}
              visible={geometry.visibleOutline}
              selectedCode={selectedCode}
              focusedCode={focusedCode}
              onSelect={onSelect}
              onFocusRegion={onFocusRegion}
              formatValue={formatTrNumber}
            />
            <SelectionLayer
              features={geometry.outline}
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
