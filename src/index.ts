/**
 * turkiye-suc-haritasi — public API.
 *
 * Phase 2 exposes the map: `CrimeHeatMap` with its legend, tooltip and
 * attribution, on top of the pure core. The sidebar, search, filter bar and
 * charts arrive in Phase 3 and are added to this barrel then.
 */

// Types
export type {
  BBox, CrimeCategory, CrimeRecord, DataWarning, DataWarningCode, FilterSet,
  GeoLevel, MetricMode, NormalizedRecord, RegionMeta, RegionPopulation,
  ScaleMode, Transform, Viewport,
} from './core/types/index.js';

// Aggregation
export type {
  BuildIndexOptions, CrimeIndex, DiffResult, RankedRegion, RankOptions, RankSort,
  RegionAggregate, RegionDiff, RollupResult,
} from './core/aggregation/index.js';
export { buildIndex, diffRollups, rankRegions, rollup, totalsByYear } from './core/aggregation/index.js';

// Color
export type {
  ColorDomain, ColorScale, ColorScaleName, ColorScaleOptions, LegendBreak, Oklab, RampFn, RGB,
} from './core/color/index.js';
export {
  DEEP_BLUE_STOPS, DIFF_STOPS, RAMPS, SPECTRAL_STOPS, computeLegendBreaks,
  createColorDomain, createColorScale, createDiffColorScale, createRamp,
  interpolateOklab, oklabToRgb, parseHex, rgbToOklab, toHex,
} from './core/color/index.js';

// Geo
export type { FitOptions, ProjectionOptions } from './core/geo/index.js';
export {
  collectBounds, computeFitTransform, createPathGenerator, createTurkeyProjection,
  cullFeatures, decodeTopology, deriveRegionMeta, featureBounds, featureCentroid,
  isVisible, regionNameMap,
} from './core/geo/index.js';

// Search
export type {
  SearchEntity, SearchEntityType, SearchIndexInput, SearchResult,
} from './core/search/index.js';
export {
  buildSearchIndex, compareTurkish, foldTurkish, scoreEntity, searchEntities,
  toTurkishLowerCase, toTurkishUpperCase,
} from './core/search/index.js';

// Formatting
export {
  EM_DASH, MINUS, formatCompactTr, formatDelta, formatPercent, formatPercentDelta,
  formatTrDecimal, formatTrNumber, formatYearRange,
} from './core/format/index.js';

// Region metadata
export {
  IL_BY_CODE, IL_REGIONS, ilCodeFromIlceCode, isValidIlCode,
} from './data/geo/region-meta.js';

// Mock data — demo only, describes nothing real
export type { MockDataOptions, MockDataset } from './data/mock/index.js';
export { MOCK_CATEGORIES, createPrng, generateMockData } from './data/mock/index.js';

// Components
export type { CrimeHeatMapProps, PanelFlags } from './components/CrimeHeatMap/index.js';
export { CrimeHeatMap } from './components/CrimeHeatMap/index.js';
export type { HeatStyle, RegionClickPayload } from './components/MapCanvas/index.js';

// Strings — override any of these via the `strings` prop
export type { PartialStrings, Strings } from './i18n/index.js';
export { mergeStrings, trStrings } from './i18n/index.js';

// Bundled geography
export {
  LEVELS, getLevelFeatures, getLevelRegionMeta,
} from './data/geo/index.js';

// Chart geometry and the validated categorical palette, for consumers building
// their own panels against the same visual language.
export type { CollapsedSlice, LinearScale, Point, Slice } from './core/chart/index.js';
export {
  CATEGORY_PALETTE, arcPath, areaPath, categoryColor, collapseSlices,
  createLinearScale, linePath, niceMax, snapToStep,
} from './core/chart/index.js';
export type { ListWindow } from './core/list/index.js';
export { computeWindow } from './core/list/index.js';
export type { PopulationIndex } from './core/aggregation/index.js';
export { buildPopulationIndex, toPerCapita } from './core/aggregation/index.js';
