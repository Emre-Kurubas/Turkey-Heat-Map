export interface MapDefsProps {
  /** Namespaces filter and clip ids so two mounted maps never collide. */
  idPrefix: string;
  blurStdDeviation: number;
  /** Union outline of the country, used to clip the bleed at the coastline. */
  outlinePath: string;
}

/**
 * SVG defs for the heat rendering.
 *
 * ids are prefixed because SVG ids are document-global: two `<CrimeHeatMap>`
 * instances on one page would otherwise share a filter, and the second would
 * silently take the first's blur radius.
 */
export function MapDefs({ idPrefix, blurStdDeviation, outlinePath }: MapDefsProps) {
  return (
    <defs>
      <filter
        id={`${idPrefix}-blur`}
        // The default filter region clips the bleed at the bounding box; widen
        // it so colour can spread past a region's own edge.
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation={blurStdDeviation} />
      </filter>
      <clipPath id={`${idPrefix}-outline`}>
        <path d={outlinePath} />
      </clipPath>
    </defs>
  );
}
