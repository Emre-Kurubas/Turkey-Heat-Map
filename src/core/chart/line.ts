export interface Point {
  x: number;
  y: number;
}

/** Polyline through the points. Empty for no points. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return '';

  const [first, ...rest] = points;
  const head = `M${first!.x},${first!.y}`;
  return rest.length === 0
    ? head
    : `${head} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')}`;
}

/** The same line closed down to a baseline, for the shaded fill under it. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return '';

  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${linePath(points)} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

/** Axis tops that read well: 1, 2, 2.5 or 5 times a power of ten. */
const STEPS = [1, 2, 2.5, 5, 10];

/**
 * Rounds a maximum up to a readable axis top.
 *
 * A raw maximum makes the top gridline an arbitrary number like 4,713, which
 * costs a reader a moment every time they look at it. Zero and non-finite
 * inputs return 1 so an empty chart still has a scale to draw against rather
 * than dividing by zero.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  // Normalizing by the magnitude puts this in [1, 10), so the final step of 10
  // always matches — `find` cannot come back empty here.
  const normalized = value / magnitude;
  const step = STEPS.find((candidate) => normalized <= candidate)!;
  return step * magnitude;
}
