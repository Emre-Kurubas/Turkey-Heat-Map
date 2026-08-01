import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { IDENTITY_TRANSFORM } from '@/context/HeatMapStore.js';
import type { RollupResult } from '@/core/aggregation/index.js';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import { formatTrNumber } from '@/core/format/index.js';
import type { MapFit } from '@/core/geo/index.js';
import type { CrimeCategory, CrimeRecord, Viewport } from '@/core/types/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { useViewAnimation } from '@/hooks/useViewAnimation.js';
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

/*
 * Gaussian std-dev for the heat glow, in projected pixels — the space the paths
 * are generated in, before the group's transform.
 *
 * Constant, deliberately. It used to be divided by the zoom so the blur stayed
 * the same number of *screen* pixels at every scale, which meant that zooming
 * in sharpened the heat until districts were flat polygons with hard edges: the
 * thing stopped looking like a heat map exactly where the detail was. Holding it
 * in projected space instead keeps the softness proportional to the regions, so
 * a district reads the same zoomed in as it does from the country view.
 *
 * It also takes the transform out of the filter's inputs entirely, so panning
 * and zooming no longer re-run the blur at all (§6.3).
 *
 * Five rather than twelve: at twelve, neighbouring blues and reds blended into
 * a flat lavender and both the ramp's colour and the district detail underneath
 * were lost.
 */
const BASE_BLUR = 5;

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
    () => geometry.provinces.map((feature) => feature.d).join(' '),
    [geometry.provinces],
  );

  /*
   * The boundary of the province being explored, once districts are what is
   * outlined.
   *
   * Zoomed in, nothing on the map says where one province ends any more — the
   * province borders are gone and the district mesh looks the same either side
   * of them. This puts the one line back that the reader still needs. It comes
   * from the open detail panel rather than from the selection, because the
   * selection is cleared by the level change that the drill-in itself causes.
   */
  const detailTarget = useHeatMapState((state) => state.detail);
  const contextFeature = useMemo(() => {
    if (level === 'il' || detailTarget === null || detailTarget.level !== 'il') return undefined;
    return geometry.provinces.find((feature) => feature.code === detailTarget.code);
  }, [level, detailTarget, geometry.provinces]);

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
  const { flyTo, glideTo } = useViewAnimation(viewport);
  const flyToRequest = useHeatMapState((state) => state.flyToRequest);

  useEffect(() => {
    if (flyToRequest === null) return;

    const bbox = geometry.bounds.get(flyToRequest);
    if (bbox !== undefined) flyTo(bbox);
    dispatch({ type: 'clearFlyTo' });
  }, [flyToRequest, geometry.bounds, flyTo, dispatch]);

  /*
   * The same channel for the return trip: closing the detail panel asks for the
   * whole country back, and the map flies there rather than cutting.
   *
   * A counter, and the previous value in a ref, rather than a nullable request
   * that gets cleared. Clearing would take a second dispatch and a second render
   * per reset, and there is nothing to clear — the number *is* the signal.
   */
  const viewResetRequest = useHeatMapState((state) => state.viewResetRequest);
  const lastResetSeen = useRef(viewResetRequest);

  useEffect(() => {
    if (viewResetRequest === lastResetSeen.current) return;
    lastResetSeen.current = viewResetRequest;
    glideTo(IDENTITY_TRANSFORM);
  }, [viewResetRequest, glideTo]);

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
            blurStdDeviation={BASE_BLUR}
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
              contextFeature={contextFeature}
            />
          </g>
        </svg>
      )}
    </div>
  );
}
