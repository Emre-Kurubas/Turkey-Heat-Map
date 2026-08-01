import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Attribution } from '@/components/Attribution/index.js';
import { FilterBar } from '@/components/FilterBar/index.js';
import { HoverTooltip } from '@/components/HoverTooltip/index.js';
import { Legend } from '@/components/Legend/index.js';
import {
  MapCanvas, type HeatStyle, type RegionClickPayload,
} from '@/components/MapCanvas/index.js';
import { RegionDetail } from '@/components/RegionDetail/index.js';
import { SearchBar } from '@/components/SearchBar/index.js';
import { Sidebar } from '@/components/Sidebar/index.js';
import { YearScope } from '@/components/YearScope/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { buildIndex, rankRegions } from '@/core/aggregation/index.js';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import type { MapFit } from '@/core/geo/index.js';
import type {
  CrimeCategory, CrimeRecord, GeoLevel, MetricMode, RegionPopulation,
  ScaleMode, Viewport,
} from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
import { useHeatMapDispatch, useHeatMapState } from '@/hooks/useHeatMapState.js';
import { useRegionDetail } from '@/hooks/useRegionDetail.js';
import { mergeStrings, type PartialStrings } from '@/i18n/index.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { reconcileProps } from './reconcile.js';
import styles from './CrimeHeatMap.module.css';
import '@/styles/index.js';

export interface PanelFlags {
  legend?: boolean;
  tooltip?: boolean;
  /** Phase 3 panels. Accepted now so the prop shape is stable. */
  sidebar?: boolean;
  search?: boolean;
  filters?: boolean;
  pie?: boolean;
  trend?: boolean;
  compare?: boolean;
}

export interface CrimeHeatMapProps {
  data: readonly CrimeRecord[];
  categories: readonly CrimeCategory[];
  population?: readonly RegionPopulation[];
  panels?: PanelFlags;
  defaultFilters?: { yearRange?: [number, number]; categories?: readonly string[] };
  defaultView?: { level?: GeoLevel; focusedIl?: string | null };
  colorScale?: ColorScaleName | RampFn;
  scaleMode?: ScaleMode;
  heatStyle?: HeatStyle;
  /**
   * How the default view sits in the container. `contain` (default) keeps the
   * whole country visible and letterboxes the leftover axis; `fill` covers the
   * container and crops the east and west edges until the reader zooms out.
   *
   * Türkiye's bounding box is about 2.3:1 and a browser window rarely exceeds
   * 1.8:1, so this is a straight trade — vertical space is bought with
   * horizontal cropping, pixel for pixel.
   */
  fit?: MapFit;
  metric?: MetricMode;
  strings?: PartialStrings;
  theme?: Record<string, string>;
  className?: string;
  style?: CSSProperties;
  debug?: boolean;
  onRegionClick?: (region: RegionClickPayload) => void;
  onDataWarning?: (warnings: readonly string[]) => void;
  onError?: (error: Error) => void;
  /** Test-only size override; jsdom reports every element as 0x0. */
  testViewport?: Viewport;
}

interface ResolvedPanels {
  legend: boolean;
  tooltip: boolean;
  sidebar: boolean;
  search: boolean;
  filters: boolean;
  pie: boolean;
  trend: boolean;
}

interface ContentProps {
  props: CrimeHeatMapProps;
  panels: ResolvedPanels;
}

/** Inner tree, so the error boundary can wrap everything that can throw. */
function Content({ props, panels }: ContentProps) {
  const {
    data, categories, population, colorScale = 'spectral', heatStyle = 'glow',
  } = props;
  const { index, rollup, scale, names, byYearAll } = useAggregates({
    data, categories, colorScale, population,
  });
  const dispatch = useHeatMapDispatch();
  const selectedCode = useHeatMapState((state) => state.selectedCode);
  const detailTarget = useHeatMapState((state) => state.detail);
  const filters = useHeatMapState((state) => state.filters);
  const detail = useRegionDetail(index, categories, filters, detailTarget);

  // Lifted here only because two panels need it — the pie reports the hovered
  // category and the filter bar highlights the matching chip. Neither imports
  // the other.
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const rows = useMemo(
    () => rankRegions(rollup, { sort: 'total-desc', names }),
    [rollup, names],
  );

  /** Category totals for the selected region, or nationally when none. */
  const categoryTotals = useMemo(() => {
    const source = selectedCode === null
      ? rollup.byCategory
      : rollup.byRegion.get(selectedCode)?.byCategory ?? new Map<string, number>();
    return new Map(source);
  }, [rollup, selectedCode]);

  /*
   * The detail panel takes the whole left edge and the map keeps the rest, so
   * every other panel stands down while it is open. Leaving them mounted put
   * the region's own donut beside a national one and stacked two search-shaped
   * boxes over a map the reader had already drilled into.
   *
   * The map itself stays — the panel answers "what is in this region", and the
   * answer is worth little without the region still visible beside it.
   */
  const detailOpen = detail !== null;

  return (
    <>
      <MapCanvas
        data={data}
        categories={categories}
        colorScale={colorScale}
        heatStyle={heatStyle}
        {...(props.fit === undefined ? {} : { fit: props.fit })}
        {...(props.onRegionClick === undefined ? {} : { onRegionClick: props.onRegionClick })}
        {...(props.testViewport === undefined ? {} : { testViewport: props.testViewport })}
      />

      <div className="hm-overlay" data-detail-open={detailOpen ? 'true' : 'false'}>
        {detailOpen ? null : (
          <>
        {/* Search and filters share one row: both change what the map shows.
            The wrapper mounts whenever either does, and the flex row collapses
            to whichever survives. */}
        {panels.search || panels.filters ? (
          <div className="hm-area-topCentre">
            {panels.search ? <SearchBar categories={categories} /> : null}
            {panels.filters ? (
              <FilterBar
                categories={categories}
                categoryTotals={categoryTotals}
                hasPopulation={population !== undefined && population.length > 0}
                highlightedCategory={hoveredCategory}
              />
            ) : null}
          </div>
        ) : null}

        {/*
          One rail, three sections. The panel flags still switch the donut, the
          year series and the region list independently; what changed is that
          they now switch sections of a shared surface rather than three cards
          scattered around the map's edge. The rail itself mounts if any of the
          three survives.
        */}
        {panels.pie || panels.trend || panels.sidebar ? (
          <div className="hm-area-left">
            <Sidebar
              rows={rows}
              scale={scale}
              categories={categories}
              categoryTotals={categoryTotals}
              byYear={byYearAll}
              total={rollup.total}
              regionName={selectedCode === null ? null : names.get(selectedCode) ?? null}
              onHoverCategory={setHoveredCategory}
              sections={{ pie: panels.pie, trend: panels.trend, list: panels.sidebar }}
            />
          </div>
        ) : null}

        {panels.legend ? (
          <div className="hm-area-bottomRight"><Legend scale={scale} /></div>
        ) : null}

          </>
        )}

        {/* Both outside the block above, and both for the same reason: they
            are captions on the map rather than panels over it. The licence
            requires the attribution whatever else is on screen, and the year
            range is what every number on screen is counted over — including
            the ones inside an open detail panel. */}
        <div className="hm-area-topRight">
          <YearScope />
        </div>

        <div className="hm-area-bottomCentre">
          <Attribution />
        </div>
      </div>

      {detail === null ? null : (
        <RegionDetail
          detail={detail}
          categories={categories}
          // Dismissing the panel undoes the whole drill-in, not just the panel:
          // the reader got here by a flight into one province, and leaving them
          // parked at that zoom with nothing selected is a dead end. The map
          // animates the way back — see MapCanvas's viewResetRequest effect.
          onClose={() => { dispatch({ type: 'requestViewReset' }); }}
        />
      )}

      {panels.tooltip ? (
        <HoverTooltip rollup={rollup} names={names} categories={categories} />
      ) : null}
    </>
  );
}

/** Türkiye crime heat map. */
export function CrimeHeatMap(props: CrimeHeatMapProps) {
  const {
    data, categories, scaleMode = 'quantile', strings: overrides,
    theme, className, style, panels, onDataWarning, onError,
  } = props;

  const strings = useMemo(() => mergeStrings(overrides), [overrides]);

  // Built once for reconciliation; useAggregates memoizes its own on the same
  // inputs, so this costs one extra pass at mount rather than one per render.
  const index = useMemo(() => {
    const knownIlceCodes = new Set(getLevelRegionMeta('ilce').keys());
    return buildIndex({ data, categories, knownIlceCodes });
  }, [data, categories]);

  // Destructured so the memo below depends on the individual fields rather than
  // on `props`, which is a fresh object every render and would defeat it.
  const { defaultFilters, defaultView, metric, population } = props;

  const reconciled = useMemo(
    () => reconcileProps({ defaultFilters, defaultView, metric, population }, index),
    [defaultFilters, defaultView, metric, population, index],
  );

  const allWarnings = useMemo(
    () => [...reconciled.warnings, ...index.warnings.map((warning) => warning.message)],
    [reconciled, index],
  );

  // Report each distinct warning set once, rather than on every render.
  const reported = useRef<string | null>(null);
  const key = allWarnings.join('|');
  if (key !== reported.current) {
    reported.current = key;
    if (allWarnings.length > 0) onDataWarning?.(allWarnings);
  }

  const [store] = useState(() => createHeatMapStore({
    level: reconciled.level,
    transform: { k: 1, x: 0, y: 0 },
    focusedCode: null,
    selectedCode: null,
    filters: reconciled.filters,
    // The same object, so `resetFilters` can compare by identity and no-op
    // when nothing has changed.
    defaultFilters: reconciled.filters,
    yearBounds: reconciled.yearBounds,
    flyToRequest: null,
    viewResetRequest: 0,
    detail: null,
    metric: reconciled.metric,
    scaleMode,
  }));
  const [hoverStore] = useState(createHoverStore);

  const rootStyle = useMemo(() => ({ ...style, ...theme }), [style, theme]);

  const resolvedPanels: ResolvedPanels = {
    legend: panels?.legend ?? true,
    tooltip: panels?.tooltip ?? true,
    sidebar: panels?.sidebar ?? true,
    search: panels?.search ?? true,
    filters: panels?.filters ?? true,
    pie: panels?.pie ?? true,
    trend: panels?.trend ?? true,
  };

  const onBoundaryError = useCallback((error: Error) => { onError?.(error); }, [onError]);

  return (
    <div
      className={className === undefined ? 'hm-root' : `hm-root ${className}`}
      style={rootStyle}
    >
      <HeatMapProvider store={store} hoverStore={hoverStore} strings={strings}>
        <ErrorBoundary
          onError={onBoundaryError}
          fallback={(
            <div className={styles.error} role="alert">
              <p className={styles.errorTitle}>{strings.error.title}</p>
              <p className={styles.errorBody}>{strings.error.body}</p>
            </div>
          )}
        >
          <Content props={props} panels={resolvedPanels} />
        </ErrorBoundary>
      </HeatMapProvider>
    </div>
  );
}
