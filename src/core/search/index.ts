export { foldTurkish, toTurkishLowerCase, toTurkishUpperCase } from './normalize.js';
export { compareTurkish } from './collate.js';
export type { SearchEntity, SearchEntityType, SearchIndexInput } from './entities.js';
export { buildSearchIndex } from './entities.js';
export type { SearchResult } from './match.js';
export { scoreEntity, searchEntities } from './match.js';
