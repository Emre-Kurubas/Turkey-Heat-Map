import { toTurkishLowerCase } from './normalize.js';

/**
 * Turkish alphabetical order.
 *
 * Not ASCII order and not `String.prototype.localeCompare` — the latter needs
 * full ICU, which small-icu Node builds lack, and would silently fall back to
 * English collation. Under English collation `Çorum` sorts after `Zonguldak`,
 * which reads as a bug to any Turkish speaker.
 */
const ALPHABET = 'abcçdefgğhıijklmnoöprsştuüvyz';

const RANK: ReadonlyMap<string, number> = new Map(
  [...ALPHABET].map((letter, index) => [letter, index]),
);

/** Characters outside the alphabet sort after every letter, in code-point order. */
const UNKNOWN_BASE = ALPHABET.length;

function rankOf(char: string): number {
  const known = RANK.get(char);
  if (known !== undefined) return known;
  return UNKNOWN_BASE + (char.codePointAt(0) ?? 0);
}

/** Comparator for `Array.prototype.sort`. Case-insensitive. */
export function compareTurkish(a: string, b: string): number {
  const left = toTurkishLowerCase(a);
  const right = toTurkishLowerCase(b);

  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    const diff = rankOf(left[i]!) - rankOf(right[i]!);
    if (diff !== 0) return diff;
  }

  return left.length - right.length;
}
