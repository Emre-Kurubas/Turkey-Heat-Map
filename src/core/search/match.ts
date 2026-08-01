import { compareTurkish } from './collate.js';
import type { SearchEntity, SearchEntityType } from './entities.js';
import { foldTurkish } from './normalize.js';

export interface SearchResult {
  readonly entity: SearchEntity;
  readonly score: number;
}

/** Score tiers, highest first. Gaps are wide enough that no bonus crosses a tier. */
const SCORE_EXACT = 1000;
const SCORE_PREFIX = 800;
const SCORE_WORD_PREFIX = 600;
const SCORE_SUBSTRING = 400;
const SCORE_FUZZY_BASE = 200;
/** Bonus for a tight match. Capped well below the 200-point tier gap. */
const MAX_TIGHTNESS_BONUS = 50;

/** Provinces outrank districts, which outrank categories, which outrank years. */
const TYPE_PRIORITY: Readonly<Record<SearchEntityType, number>> = {
  il: 0, ilce: 1, category: 2, year: 3,
};

const DEFAULT_LIMIT = 20;
const MAX_EDIT_DISTANCE = 2;
/** Below this length a typo is indistinguishable from a different word. */
const MIN_FUZZY_LENGTH = 4;

/**
 * Levenshtein distance, abandoned once it exceeds `max`.
 *
 * Bounded because an unbounded distance over 1,070 entities on every keystroke
 * is wasted work: anything beyond two edits is not a typo, it is a different word.
 */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > max) return max + 1;
    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
}

/**
 * Scores one entity against an already-folded query. 0 means no match.
 *
 * A short bonus for tight matches keeps "İzmir" above "İzmit Merkez" for the
 * query "izmi", without ever letting a bonus push a result across a tier
 * boundary.
 */
export function scoreEntity(foldedQuery: string, entity: SearchEntity): number {
  if (foldedQuery === '') return 0;

  const { folded } = entity;
  const tightness = Math.max(0, MAX_TIGHTNESS_BONUS - (folded.length - foldedQuery.length));

  if (folded === foldedQuery) return SCORE_EXACT;
  if (folded.startsWith(foldedQuery)) return SCORE_PREFIX + tightness;
  if (folded.includes(` ${foldedQuery}`)) return SCORE_WORD_PREFIX + tightness;
  if (folded.includes(foldedQuery)) return SCORE_SUBSTRING + tightness;

  if (foldedQuery.length >= MIN_FUZZY_LENGTH) {
    const distance = boundedEditDistance(foldedQuery, folded, MAX_EDIT_DISTANCE);
    if (distance <= MAX_EDIT_DISTANCE) {
      return SCORE_FUZZY_BASE + (MAX_EDIT_DISTANCE - distance) * 25;
    }
  }

  return 0;
}

/**
 * Searches every entity type at once and returns ranked results.
 *
 * Ties break by type priority then Turkish alphabetical order, never by array
 * position, so the dropdown never reshuffles between renders on identical input.
 */
export function searchEntities(
  index: readonly SearchEntity[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): SearchResult[] {
  const folded = foldTurkish(query.trim());
  if (folded === '' || limit <= 0) return [];

  const matches: SearchResult[] = [];
  for (const entity of index) {
    const score = scoreEntity(folded, entity);
    if (score > 0) matches.push({ entity, score });
  }

  matches.sort((a, b) =>
    b.score - a.score
    || TYPE_PRIORITY[a.entity.type] - TYPE_PRIORITY[b.entity.type]
    || compareTurkish(a.entity.label, b.entity.label));

  return matches.slice(0, limit);
}
