export interface ArcOptions {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  /** Radians, clockwise from twelve o'clock. */
  startAngle: number;
  endAngle: number;
}

/** Polar to cartesian, with 0 radians at twelve o'clock and angles running clockwise. */
function pointAt(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
}

const FULL_TURN = Math.PI * 2;

/**
 * One donut segment as an SVG path.
 *
 * Angles start at twelve o'clock rather than three, because a share chart is
 * read clockwise from the top and the largest slice belongs there.
 *
 * A zero or negative sweep returns an empty path. Emitting a degenerate arc
 * instead would draw a hairline spoke across the ring — visible, meaningless,
 * and hard to trace back to a slice whose value happens to be zero.
 */
export function arcPath(options: ArcOptions): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = options;

  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';

  // A full ring drawn as a single arc collapses to a point; stop just short.
  const end = sweep >= FULL_TURN ? startAngle + FULL_TURN - 1e-6 : endAngle;
  const largeArc = end - startAngle > Math.PI ? 1 : 0;

  const [ox0, oy0] = pointAt(cx, cy, outerRadius, startAngle);
  const [ox1, oy1] = pointAt(cx, cy, outerRadius, end);

  if (innerRadius <= 0) {
    return [
      `M${ox0},${oy0}`,
      `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${ox1},${oy1}`,
      `L${cx},${cy}`,
      'Z',
    ].join(' ');
  }

  const [ix1, iy1] = pointAt(cx, cy, innerRadius, end);
  const [ix0, iy0] = pointAt(cx, cy, innerRadius, startAngle);

  return [
    `M${ox0},${oy0}`,
    `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${ox1},${oy1}`,
    `L${ix1},${iy1}`,
    `A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${ix0},${iy0}`,
    'Z',
  ].join(' ');
}
