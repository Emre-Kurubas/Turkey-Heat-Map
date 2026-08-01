/**
 * Turns raw geoBoundaries downloads into the coded GeoJSON `build-geo` expects.
 *
 * The published sources carry correct Turkish names and clean geometry but no
 * administrative codes, and district names are not unique — `Yenişehir` occurs
 * three times, `Kale` and `Gölbaşı` twice each — so districts are attached to
 * provinces geometrically rather than by name.
 *
 *   npm run prepare:geo -- --il-src raw/adm1.geojson --ilce-src raw/adm2.geojson --out raw/
 *
 * Then feed the output to `npm run build:geo`. See scripts/README.md for the
 * full pipeline and the licensing terms that come with the source data.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { compareTurkish } from '../src/core/search/collate.js';
import { foldTurkish } from '../src/core/search/normalize.js';
import { IL_BY_CODE, IL_REGIONS } from '../src/core/geo/regions.js';
import {
  bboxOf, pointInPolygons, polygonsOf, representativePoint,
  type PolygonRings, type Position,
} from './geo/planar.js';

interface PreparedProvince {
  readonly code: string;
  readonly name: string;
  readonly geometry: GeoJSON.Geometry;
  readonly polygons: readonly PolygonRings[];
  readonly bbox: readonly [number, number, number, number];
}

/** Province code keyed by the exact canonical name in `region-meta`. */
const CODE_BY_NAME = new Map(IL_REGIONS.map((region) => [region.name, region.code]));

function readCollection(path: string): GeoJSON.FeatureCollection {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as GeoJSON.FeatureCollection;
}

/** Reads `properties.shapeName`, the geoBoundaries name field. */
function shapeName(feature: GeoJSON.Feature): string {
  const value: unknown = feature.properties?.['shapeName'];
  return typeof value === 'string' ? value : '';
}

/**
 * Suffixes the source uses for a province's central district, folded.
 *
 * The source is inconsistent here — `Adıyaman merkez`, `Artvin Merkez`,
 * `Bilecik (merkez)`, `Afyonkarahisar (Merkez İlçe)`, `Rize merkezi` and
 * `Giresun District` all name the same kind of place.
 */
const CENTRAL_SUFFIXES = new Set([
  'merkez', 'merkezi', '(merkez)', '(merkezilce)', 'district',
  // Ardahan's centre is listed as bare `Ardahan`. A district carrying its own
  // province's name is that province's centre by definition, and Ardahan is the
  // only such case in the source.
  '',
]);

/**
 * Districts the source names in English or misnames outright.
 *
 * `Gediz Merkez` is not Kütahya's centre — Kütahya's centre is listed
 * separately — so it keeps its own name rather than collapsing to `Merkez`.
 */
const NAME_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ['Prince Islands', 'Adalar'],
  ['Gediz Merkez', 'Gediz'],
]);

/**
 * Gives every central district the single name Turkish administration uses:
 * `Merkez`.
 *
 * Matching folds both sides, so `Hakkari merkez` is recognised against the
 * province `Hakkâri` despite the missing circumflex. Names that merely begin
 * with `Merkez` — Denizli's `Merkezefendi` — are left alone, because the
 * comparison is against the province name, not the word.
 */
export function normalizeDistrictName(name: string, ilName: string): string {
  const override = NAME_OVERRIDES.get(name);
  if (override !== undefined) return override;

  if (foldTurkish(name) === 'merkez') return 'Merkez';

  const foldedIl = foldTurkish(ilName);
  const folded = foldTurkish(name);
  if (!folded.startsWith(foldedIl)) return name;

  const suffix = folded.slice(foldedIl.length).replace(/[\s\u00A0]/gu, '');
  return CENTRAL_SUFFIXES.has(suffix) ? 'Merkez' : name;
}

function fail(message: string): never {
  console.error(`[prepare-geo] ${message}`);
  process.exit(1);
}

/**
 * Matches province features to plaka codes by exact canonical name.
 *
 * Exact matching is intentional. A fuzzy fallback would quietly accept an
 * outdated name — `Afyon` for `Afyonkarahisar`, `İçel` for `Mersin` — and bind
 * it to a province whose data would then never line up.
 */
export function codeProvinces(features: readonly GeoJSON.Feature[]): PreparedProvince[] {
  const unmatched: string[] = [];
  const prepared: PreparedProvince[] = [];

  for (const feature of features) {
    const name = shapeName(feature);
    const code = CODE_BY_NAME.get(name);
    if (code === undefined) { unmatched.push(name || '(isimsiz)'); continue; }

    const polygons = polygonsOf(feature);
    prepared.push({
      code, name, polygons,
      geometry: feature.geometry,
      bbox: bboxOf(polygons),
    });
  }

  if (unmatched.length > 0) {
    fail(`Kaynakta tanınmayan il adları (${unmatched.length}): ${unmatched.join(', ')}`);
  }
  const missing = IL_REGIONS.filter((r) => !prepared.some((p) => p.code === r.code));
  if (missing.length > 0) {
    fail(`Kaynakta eksik iller (${missing.length}): ${missing.map((r) => r.name).join(', ')}`);
  }
  return prepared;
}

/** The province whose polygon contains `point`, or null when none does. */
export function provinceAt(
  point: Position,
  provinces: readonly PreparedProvince[],
): PreparedProvince | null {
  for (const province of provinces) {
    const [minX, minY, maxX, maxY] = province.bbox;
    if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) continue;
    if (pointInPolygons(point, province.polygons)) return province;
  }
  return null;
}

/**
 * Assigns each district a `{plaka}{sıra}` code, sequenced by Turkish
 * alphabetical order inside its province.
 *
 * The sequence is positional, not an official TÜİK identifier — no public
 * dataset pairs district boundaries with TÜİK codes. It satisfies the contract
 * `ilCodeFromIlceCode` enforces (4 digits, first two are the plaka code) and is
 * stable across runs, so the shipped map and `region-meta` always agree.
 * Consumers holding real TÜİK-coded data need a crosswalk; scripts/README.md
 * documents this.
 */
export function assignDistrictCodes(
  districts: readonly { province: PreparedProvince; name: string; feature: GeoJSON.Feature }[],
): GeoJSON.Feature[] {
  const byProvince = new Map<string, typeof districts[number][]>();
  for (const district of districts) {
    const bucket = byProvince.get(district.province.code) ?? [];
    bucket.push(district);
    byProvince.set(district.province.code, bucket);
  }

  const out: GeoJSON.Feature[] = [];
  for (const [ilCode, bucket] of [...byProvince.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (bucket.length > 99) {
      fail(`${IL_BY_CODE.get(ilCode)?.name ?? ilCode} ilinde 99'dan fazla ilçe var (${bucket.length}).`);
    }
    const sorted = [...bucket].sort((a, b) => compareTurkish(a.name, b.name));
    sorted.forEach((district, index) => {
      out.push({
        type: 'Feature',
        id: `${ilCode}${String(index + 1).padStart(2, '0')}`,
        properties: { name: district.name, ilCode },
        geometry: district.feature.geometry,
      });
    });
  }
  return out;
}

function parseArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key !== undefined && value !== undefined && key.startsWith('--')) {
      args.set(key.slice(2), value);
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const ilSrc = args.get('il-src');
  const ilceSrc = args.get('ilce-src');
  const outDir = args.get('out') ?? '.';
  if (ilSrc === undefined || ilceSrc === undefined) {
    fail('--il-src <geojson> ve --ilce-src <geojson> gerekli.');
  }

  const provinces = codeProvinces(readCollection(ilSrc).features);
  console.log(`[prepare-geo] ${provinces.length} il kodlandı.`);

  const districtSource = readCollection(ilceSrc).features;
  const located: { province: PreparedProvince; name: string; feature: GeoJSON.Feature }[] = [];
  const orphans: string[] = [];

  for (const feature of districtSource) {
    const province = provinceAt(representativePoint(polygonsOf(feature)), provinces);
    if (province === null) { orphans.push(shapeName(feature)); continue; }
    located.push({
      province,
      name: normalizeDistrictName(shapeName(feature), province.name),
      feature,
    });
  }

  // An unplaceable district would vanish from the map, so this never degrades
  // to a nearest-province guess.
  if (orphans.length > 0) {
    fail(`Hiçbir ile düşmeyen ilçeler (${orphans.length}): ${orphans.join(', ')}`);
  }

  const districts = assignDistrictCodes(located);

  const ilOut: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: provinces.map((province) => ({
      type: 'Feature',
      id: province.code,
      properties: { name: province.name },
      geometry: province.geometry,
    })),
  };
  const ilceOut: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: districts };

  writeFileSync(resolve(outDir, 'il.geojson'), JSON.stringify(ilOut));
  writeFileSync(resolve(outDir, 'ilce.geojson'), JSON.stringify(ilceOut));
  console.log(`[prepare-geo] ${districts.length} ilçe kodlandı → ${resolve(outDir)}`);
}

if (process.argv[1]?.endsWith('prepare-geo-source.ts') === true) main();
