import { EM_DASH, MINUS, formatTrDecimal, formatTrNumber } from './number.js';

/** Formats an absolute change with an explicit sign. Zero carries no sign. */
export function formatDelta(delta: number): string {
  if (!Number.isFinite(delta)) return EM_DASH;
  if (delta === 0) return '0';
  return delta > 0 ? `+${formatTrNumber(delta)}` : formatTrNumber(delta);
}

/**
 * Formats a signed percentage change.
 *
 * `null` means the change is undefined — which happens whenever the baseline is
 * zero, since growth from nothing has no meaningful ratio. Callers must pass
 * null rather than Infinity so the distinction survives to the UI.
 */
export function formatPercentDelta(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return EM_DASH;

  const magnitude = `%${formatTrDecimal(Math.abs(ratio) * 100, 1)}`;
  if (ratio === 0) return magnitude;
  return ratio > 0 ? `+${magnitude}` : `${MINUS}${magnitude}`;
}
