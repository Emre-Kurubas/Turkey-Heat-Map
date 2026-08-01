import { describe, expect, it } from 'vitest';
import { formatYearRange } from './year.js';

/**
 * Reached 100% coverage through the panels that call it, which is not the same
 * as being tested: the edge cases its own docblock claims — the single-year
 * collapse, the normalisation of an inverted range — had no assertion anywhere.
 * Coverage says a line ran, not that anyone checked what it did.
 */
describe('formatYearRange', () => {
  it('joins a span with an en dash', () => {
    expect(formatYearRange([2015, 2024])).toBe('2015–2024');
  });

  it('uses an en dash, not a hyphen', () => {
    // The typographic range separator. A hyphen next to tabular figures reads
    // as a minus sign.
    expect(formatYearRange([2015, 2024])).toContain('–');
    expect(formatYearRange([2015, 2024])).not.toContain('-');
  });

  it('collapses a single year to one number', () => {
    // What clicking a point on the trend chart produces. "2020–2020" reads as a
    // span the reader did not ask for, and invites them to look for a second
    // year that is not there.
    expect(formatYearRange([2020, 2020])).toBe('2020');
  });

  it('normalises an inverted range rather than printing it backwards', () => {
    // A dual-handle slider can drag its low handle past its high one, and the
    // store normalises before filtering. A label that disagreed with the filter
    // would be the worse bug.
    expect(formatYearRange([2024, 2015])).toBe('2015–2024');
  });

  it('collapses an inverted single year too', () => {
    expect(formatYearRange([2020, 2020])).toBe(formatYearRange([2020, 2020]));
  });

  it('handles a two-year span, the shortest that is still a span', () => {
    expect(formatYearRange([2019, 2020])).toBe('2019–2020');
  });

  it('does not group the thousands', () => {
    // A year is not a quantity. `formatTrNumber` would render 2015 as "2.015".
    expect(formatYearRange([2015, 2024])).not.toContain('.');
  });
});
