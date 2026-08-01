/**
 * Converts source administrative boundaries into the simplified TopoJSON the
 * package ships.
 *
 * Run manually when boundary data changes — not part of `npm run build`. The
 * committed TopoJSON is the artifact; this script is how it is regenerated.
 *
 *   npm run build:geo -- --il path/to/il.geojson --ilce path/to/ilce.geojson
 *
 * Source data is expected to be OpenStreetMap-derived (ODbL, attribution
 * required) unless officially licensed HGM/TÜİK data is available. See
 * scripts/README.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { IL_BY_CODE, ilCodeFromIlceCode, isValidIlCode } from '../src/data/geo/region-meta.js';

export type GeoLevelName = 'il' | 'ilce';

export interface ValidationReport {
  ok: boolean;
  /** Expected but absent from the source. */
  missingCodes: string[];
  /** Present in the source but not a real code. */
  unknownCodes: string[];
  duplicateCodes: string[];
  unnamedCodes: string[];
  /** Provinces with no districts at all — a hole at ilçe zoom. */
  provincesWithoutDistricts: string[];
}

/**
 * Checks that boundary codes and the data layer's codes agree, in both
 * directions.
 *
 * A province missing from the boundary file renders a hole in the map. A code in
 * the boundary file that the data layer does not recognize renders a region that
 * can never be colored. Both are invisible in production and obvious here, so
 * the build fails on either.
 */
export function validateFeatures(
  features: readonly GeoJSON.Feature[],
  level: GeoLevelName,
): ValidationReport {
  const unknownCodes: string[] = [];
  const duplicateCodes: string[] = [];
  const unnamedCodes: string[] = [];
  const seen = new Set<string>();
  const coveredProvinces = new Set<string>();

  for (const feature of features) {
    if (feature.id === undefined || feature.id === null) {
      unknownCodes.push('(id yok)');
      continue;
    }

    const code = String(feature.id);
    if (seen.has(code)) {
      duplicateCodes.push(code);
      continue;
    }
    seen.add(code);

    if (level === 'il') {
      if (!isValidIlCode(code)) { unknownCodes.push(code); continue; }
      coveredProvinces.add(code);
    } else {
      const parent = ilCodeFromIlceCode(code);
      if (parent === null) { unknownCodes.push(code); continue; }
      coveredProvinces.add(parent);
    }

    // GeoJSON properties carry an `any` index signature; narrow it deliberately.
    const name: unknown = feature.properties?.['name'];
    if (typeof name !== 'string' || name === '') unnamedCodes.push(code);
  }

  // The number of districts is not fixed, so only il level has a required set.
  const missingCodes = level === 'il'
    ? [...IL_BY_CODE.keys()].filter((code) => !seen.has(code))
    : [];

  const provincesWithoutDistricts = level === 'ilce'
    ? [...IL_BY_CODE.keys()].filter((code) => !coveredProvinces.has(code))
    : [];

  return {
    ok: missingCodes.length === 0
      && unknownCodes.length === 0
      && duplicateCodes.length === 0
      && unnamedCodes.length === 0
      && provincesWithoutDistricts.length === 0,
    missingCodes, unknownCodes, duplicateCodes, unnamedCodes, provincesWithoutDistricts,
  };
}

function reportOrExit(report: ValidationReport, level: GeoLevelName): void {
  if (report.ok) return;

  console.error(`\n[build-geo] ${level} sınır verisi doğrulanamadı:`);
  const sections: [string, string[]][] = [
    ['Eksik kodlar', report.missingCodes],
    ['Tanınmayan kodlar', report.unknownCodes],
    ['Yinelenen kodlar', report.duplicateCodes],
    ['İsimsiz bölgeler', report.unnamedCodes],
    ['İlçesi olmayan iller', report.provincesWithoutDistricts],
  ];
  for (const [label, codes] of sections) {
    if (codes.length > 0) console.error(`  ${label} (${codes.length}): ${codes.join(', ')}`);
  }
  process.exit(1);
}

/** Drops presimplify weights below the threshold, then writes the topology. */
function buildTopology(
  features: GeoJSON.Feature[],
  level: GeoLevelName,
  minWeight: number,
): unknown {
  const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  // @types/topojson-server types feature properties as GeoJsonProperties (which
  // admits null) while @types/topojson-simplify requires a non-null object. The
  // runtime shapes are identical; this reconciles the two declarations.
  const raw = topology({ [level]: collection }) as unknown as Parameters<typeof presimplify>[0];

  return simplify(presimplify(raw), minWeight);
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
  const outDir = args.get('out') ?? 'src/data/geo';

  // İl geometry is only ever seen at country zoom, so it is simplified harder.
  const levels: [GeoLevelName, number][] = [['il', 1e-6], ['ilce', 1e-7]];

  for (const [level, minWeight] of levels) {
    const input = args.get(level);
    if (input === undefined) {
      console.error(`[build-geo] --${level} <geojson> gerekli.`);
      process.exit(1);
      return;
    }

    const source = JSON.parse(readFileSync(resolve(input), 'utf8')) as GeoJSON.FeatureCollection;
    reportOrExit(validateFeatures(source.features, level), level);

    const outPath = resolve(outDir, `turkiye-${level}.topo.json`);
    writeFileSync(outPath, JSON.stringify(buildTopology(source.features, level, minWeight)));

    const sizeKb = Math.round(readFileSync(outPath).byteLength / 1024);
    console.log(`[build-geo] ${level}: ${source.features.length} bölge → ${outPath} (${sizeKb} KB)`);
  }
}

// Only run when invoked directly, so the test can import validateFeatures.
if (process.argv[1]?.endsWith('build-geo.ts') === true) main();
