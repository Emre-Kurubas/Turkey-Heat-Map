import type { CrimeCategory } from '@/core/types/index.js';

/**
 * Demo crime categories, loosely modelled on TÜİK's published groupings.
 * Illustrative only — not an official taxonomy.
 */
export const MOCK_CATEGORIES: readonly CrimeCategory[] = [
  { id: 'hirsizlik', label: 'Hırsızlık' },
  { id: 'yaralama', label: 'Yaralama' },
  { id: 'dolandiricilik', label: 'Dolandırıcılık' },
  { id: 'uyusturucu', label: 'Uyuşturucu' },
  { id: 'gasp', label: 'Gasp' },
  { id: 'trafik', label: 'Trafik Suçları' },
  { id: 'siber', label: 'Siber Suçlar' },
  { id: 'kacakcilik', label: 'Kaçakçılık' },
];
