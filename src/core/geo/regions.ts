import type { RegionMeta } from '@/core/types/index.js';

/*
 * The 81 provinces, and the rules for reading a Turkish administrative code.
 *
 * In `core/` rather than in `data/` because `core/` needs it: the record
 * validator has to know a real plaka code from a typo, and `deriveRegionMeta`
 * has to know that a district's parent is its first two digits. Those are the
 * country's own numbering rules, as fixed as the projection `core/geo` already
 * carries — not geometry that happens to be bundled.
 *
 * It sat in `data/` and left the two layers pointing at each other: `core`
 * reached down for these helpers while `data/geo` reached up for
 * `decodeTopology`. Nothing was circular at file level, but the direction of
 * the dependency was no longer a fact anyone could state.
 */

/** Province name by official plaka code. Reference data; do not reorder. */
const IL_NAMES: Readonly<Record<string, string>> = {
  '01': 'Adana',        '02': 'Adıyaman',      '03': 'Afyonkarahisar', '04': 'Ağrı',
  '05': 'Amasya',       '06': 'Ankara',        '07': 'Antalya',        '08': 'Artvin',
  '09': 'Aydın',        '10': 'Balıkesir',     '11': 'Bilecik',        '12': 'Bingöl',
  '13': 'Bitlis',       '14': 'Bolu',          '15': 'Burdur',         '16': 'Bursa',
  '17': 'Çanakkale',    '18': 'Çankırı',       '19': 'Çorum',          '20': 'Denizli',
  '21': 'Diyarbakır',   '22': 'Edirne',        '23': 'Elazığ',         '24': 'Erzincan',
  '25': 'Erzurum',      '26': 'Eskişehir',     '27': 'Gaziantep',      '28': 'Giresun',
  '29': 'Gümüşhane',    '30': 'Hakkâri',       '31': 'Hatay',          '32': 'Isparta',
  '33': 'Mersin',       '34': 'İstanbul',      '35': 'İzmir',          '36': 'Kars',
  '37': 'Kastamonu',    '38': 'Kayseri',       '39': 'Kırklareli',     '40': 'Kırşehir',
  '41': 'Kocaeli',      '42': 'Konya',         '43': 'Kütahya',        '44': 'Malatya',
  '45': 'Manisa',       '46': 'Kahramanmaraş', '47': 'Mardin',         '48': 'Muğla',
  '49': 'Muş',          '50': 'Nevşehir',      '51': 'Niğde',          '52': 'Ordu',
  '53': 'Rize',         '54': 'Sakarya',       '55': 'Samsun',         '56': 'Siirt',
  '57': 'Sinop',        '58': 'Sivas',         '59': 'Tekirdağ',       '60': 'Tokat',
  '61': 'Trabzon',      '62': 'Tunceli',       '63': 'Şanlıurfa',      '64': 'Uşak',
  '65': 'Van',          '66': 'Yozgat',        '67': 'Zonguldak',      '68': 'Aksaray',
  '69': 'Bayburt',      '70': 'Karaman',       '71': 'Kırıkkale',      '72': 'Batman',
  '73': 'Şırnak',       '74': 'Bartın',        '75': 'Ardahan',        '76': 'Iğdır',
  '77': 'Yalova',       '78': 'Karabük',       '79': 'Kilis',          '80': 'Osmaniye',
  '81': 'Düzce',
};

export const IL_REGIONS: readonly RegionMeta[] = Object.entries(IL_NAMES).map(
  ([code, name]) => ({ code, name, parentCode: null }),
);

export const IL_BY_CODE: ReadonlyMap<string, RegionMeta> = new Map(
  IL_REGIONS.map((region) => [region.code, region]),
);

/** True when `code` is a real, correctly zero-padded plaka code. */
export function isValidIlCode(code: string): boolean {
  return IL_BY_CODE.has(code);
}

/**
 * Derives the parent province code from a 4-digit ilçe code.
 * Returns null if the code is malformed or names no real province.
 */
export function ilCodeFromIlceCode(ilceCode: string): string | null {
  if (!/^\d{4}$/u.test(ilceCode)) return null;
  const ilCode = ilceCode.slice(0, 2);
  return isValidIlCode(ilCode) ? ilCode : null;
}
