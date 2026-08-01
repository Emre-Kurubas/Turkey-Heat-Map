/**
 * Turkish-aware text normalization.
 *
 * JavaScript's built-in case conversion is wrong for Turkish. `"I".toLowerCase()`
 * yields `"i"` (should be `"ı"`), and `"İ".toLowerCase()` yields `"i" + U+0307`
 * (a combining dot above). Both break naive search matching, so this module
 * replaces the built-ins entirely for Turkish text.
 */

/** Search fold: every variant of a letter collapses to one ASCII key. */
const FOLD_MAP: Readonly<Record<string, string>> = {
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i', İ: 'i', i: 'i',
  ö: 'o', Ö: 'o',
  ş: 's', Ş: 's',
  ü: 'u', Ü: 'u',
  â: 'a', Â: 'a',
  î: 'i', Î: 'i',
  û: 'u', Û: 'u',
};

/** Unicode combining diacritical marks, stripped after NFD decomposition. */
const COMBINING_MARKS = /[̀-ͯ]/gu;

/**
 * Folds text to a lowercase ASCII search key.
 *
 * Both `I` and `İ` fold to `i`, so a user typing `istanbul`, `ıstanbul`, or
 * `İSTANBUL` all match the same entry. This is intentionally lossier than
 * correct Turkish casing — it is for matching, never for display.
 */
export function foldTurkish(input: string): string {
  if (input === '') return '';

  let out = '';
  for (const ch of input.normalize('NFC')) {
    const mapped = FOLD_MAP[ch];
    out += mapped ?? ch.toLowerCase();
  }

  // Strip any combining marks left by characters not in FOLD_MAP.
  return out.normalize('NFD').replace(COMBINING_MARKS, '');
}

/** Locale-correct Turkish lowercase, for display. */
export function toTurkishLowerCase(input: string): string {
  return input.replace(/İ/gu, 'i').replace(/I/gu, 'ı').toLowerCase();
}

/** Locale-correct Turkish uppercase, for display. */
export function toTurkishUpperCase(input: string): string {
  return input.replace(/i/gu, 'İ').replace(/ı/gu, 'I').toUpperCase();
}
