/**
 * Deterministic tr-TR number formatting.
 *
 * Deliberately hand-rolled rather than using `Intl.NumberFormat`: some Node
 * builds ship with small-icu, where `tr-TR` silently falls back to `en-US` and
 * produces `1,234,567` instead of `1.234.567`. Formatting must be byte-identical
 * in tests, in CI, and in every browser.
 */

/** U+2212 MINUS SIGN. Visually balanced with digits, unlike the hyphen. */
export const MINUS = '−';
/** Placeholder for values that do not exist. */
export const EM_DASH = '—';

const GROUP_SEPARATOR = '.';
const DECIMAL_SEPARATOR = ',';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/gu, GROUP_SEPARATOR);
}

/** Formats an integer with `.` thousands separators. Rounds non-integers. */
export function formatTrNumber(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  return sign + groupThousands(Math.abs(rounded).toFixed(0));
}

/** Formats with a fixed number of decimals, using `,` as the decimal separator. */
export function formatTrDecimal(value: number, digits: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const sign = value < 0 ? MINUS : '';
  const fixed = Math.abs(value).toFixed(digits);
  const [intPart = '0', fracPart] = fixed.split('.');
  const grouped = groupThousands(intPart);

  return fracPart === undefined
    ? sign + grouped
    : sign + grouped + DECIMAL_SEPARATOR + fracPart;
}

const COMPACT_UNITS: readonly { readonly threshold: number; readonly suffix: string }[] = [
  { threshold: 1_000_000_000, suffix: 'Mr' }, // milyar
  { threshold: 1_000_000, suffix: 'Mn' },     // milyon
  { threshold: 1_000, suffix: 'B' },          // bin
];

/** Abbreviates large numbers using Turkish unit suffixes: B, Mn, Mr. */
export function formatCompactTr(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;

  const abs = Math.abs(value);
  for (const { threshold, suffix } of COMPACT_UNITS) {
    if (abs >= threshold) {
      return `${formatTrDecimal(value / threshold, 1)} ${suffix}`;
    }
  }
  return formatTrNumber(value);
}
