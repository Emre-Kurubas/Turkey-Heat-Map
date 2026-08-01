export interface Strings {
  map: {
    /** Accessible name of the map region. */
    label: string;
    /** Announced while geometry is still loading. */
    loading: string;
    zoomIn: string;
    zoomOut: string;
    resetView: string;
  };
  level: {
    il: string;
    ilce: string;
  };
  legend: {
    title: string;
    noData: string;
    /** Shown beneath the ramp so a quantile map is never read as absolute. */
  };
  filters: {
    title: string;
    yearRange: string;
    categories: string;
    reset: string;
    perCapita: string;
    /** Shown when no category chip is selected — empty means every category. */
    /** Shown when nothing is ticked, because empty means "every category". */
    allCategories: string;
    /** Follows the count: "3 seçili". */
    selectedSuffix: string;
    searchCategories: string;
    noCategoryMatch: string;
    /** Follows the count of results the list did not draw. */
    moreCategories: string;
    removeCategory: string;
    clearCategories: string;
    /** Accessible names for the collapse toggle. */
    open: string;
    close: string;
  };
  detail: {
    close: string;
    total: string;
    categories: string;
    /** Heading over the district leaderboard in a province's panel. */
    districts: string;
    noChildren: string;
    empty: string;
  };
  pie: {
    title: string;
    /** Shown when no region is selected. */
    national: string;
    other: string;
    /** Accessible names for the Diğer disclosure. */
    expand: string;
    collapse: string;
    empty: string;
  };
  trend: { title: string; empty: string; year: string };
  sidebar: {
    title: string;
    collapse: string;
    expand: string;
    empty: string;
    topList: string;
  };
  search: {
    label: string;
    placeholder: string;
    noResults: string;
    /** Dropdown group headings, keyed by SearchEntityType. */
    groups: { il: string; ilce: string; category: string; year: string };
  };
  scaleMode: {
    linear: string;
    log: string;
    quantile: string;
  };
  tooltip: {
    title: (regionName: string) => string;
    total: string;
    noData: string;
    topCategories: string;
    yearOverYear: string;
  };
  attribution: {
    /** Rendered in the map corner. Non-removable. */
    text: string;
    label: string;
  };
  error: {
    title: string;
    body: string;
  };
}

/**
 * Deep-partial, for the `strings` prop.
 *
 * Explicit `undefined` is permitted on the leaves, not just omission. Under
 * `exactOptionalPropertyTypes` a plain `Partial<T>` would reject
 * `{ title: maybeString }`, which is exactly how a consumer forwards their own
 * optional prop. `mergeStrings` treats such a value as "not provided".
 */
export type PartialStrings = {
  [K in keyof Strings]?: {
    [P in keyof Strings[K]]?: Strings[K][P] | undefined;
  };
};
