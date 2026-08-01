/** U+2013 EN DASH. The typographic range separator, not a hyphen. */
const RANGE_DASH = '–';

/**
 * Renders a year range for display: `2015–2024`, or just `2020` when the range
 * covers a single year.
 *
 * Collapsing the single-year case matters because that is what clicking a point
 * on the trend chart produces. `2020–2020` reads as a span the reader did not
 * ask for, and invites them to look for the second year.
 *
 * Inverted input is normalised rather than rejected. A dual-handle slider can
 * drag its low handle past its high one, and the store already normalises for
 * filtering — a label that disagreed with the filter would be the worse bug.
 */
export function formatYearRange(range: readonly [number, number]): string {
  const [a, b] = range;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return start === end ? String(start) : `${start}${RANGE_DASH}${end}`;
}
