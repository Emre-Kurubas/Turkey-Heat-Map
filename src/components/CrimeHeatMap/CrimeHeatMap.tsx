import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Attribution } from '@/components/Attribution/index.js';
import { HoverTooltip } from '@/components/HoverTooltip/index.js';
import { Legend } from '@/components/Legend/index.js';
import {
  MapCanvas, type HeatStyle, type RegionClickPayload,
} from '@/components/MapCanvas/index.js';
import { HeatMapProvider } from '@/context/HeatMapProvider.js';
import { createHeatMapStore } from '@/context/HeatMapStore.js';
import { createHoverStore } from '@/context/HoverStore.js';
import { buildIndex } from '@/core/aggregation/index.js';
import type { ColorScaleName, RampFn } from '@/core/color/index.js';
import type {
  CrimeCategory, CrimeRecord, GeoLevel, MetricMode, RegionPopulation,
  ScaleMode, Viewport,
} from '@/core/types/index.js';
import { getLevelRegionMeta } from '@/data/geo/index.js';
import { useAggregates } from '@/hooks/useAggregates.js';
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

interface ContentProps {
  props: CrimeHeatMapProps;
  panels: { legend: boolean; tooltip: boolean };
}

/** Inner tree, so the error boundary can wrap everything that can throw. */
function Content({ props, panels }: ContentProps) {
  const { data, categories, colorScale = 'spectral', heatStyle = 'glow' } = props;
  const { rollup, scale, names } = useAggregates({ data, categories, colorScale });

  return (
    <>
      <MapCanvas
        data={data}
        categories={categories}
        colorScale={colorScale}
        heatStyle={heatStyle}
        {...(props.onRegionClick === undefined ? {} : { onRegionClick: props.onRegionClick })}
        {...(props.testViewport === undefined ? {} : { testViewport: props.testViewport })}
      />

      <div className="hm-overlay">
        <div className={styles.bottomLeft}>
          {panels.legend ? <Legend scale={scale} /> : null}
          <Attribution />
        </div>
      </div>

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
    metric: reconciled.metric,
    scaleMode,
  }));
  const [hoverStore] = useState(createHoverStore);

  const rootStyle = useMemo(() => ({ ...style, ...theme }), [style, theme]);

  const resolvedPanels = {
    legend: panels?.legend ?? true,
    tooltip: panels?.tooltip ?? true,
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
