import { EM_DASH, formatTrDecimal } from './number.js';

/**
 * Formats a 0..1 ratio as a Turkish percentage.
 *
 * Turkish writes the percent sign *before* the number: `%12,3`, not `12,3%`.
 */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return EM_DASH;
  return `%${formatTrDecimal(ratio * 100, digits)}`;
}
