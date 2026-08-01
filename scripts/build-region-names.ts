/**
 * Extracts the district name table out of the district topology.
 *
 * The two are needed at completely different moments. Every district's code and
 * name is wanted the instant the component mounts — to validate incoming
 * records, to build the search index, to label a tooltip — while the geometry is
 * only wanted once the map actually draws district boundaries. Bundling them
 * together meant 268 KB of arcs had to be parsed before the first province could
 * be painted.
 *
 * So the names are lifted into their own module, which stays in the main bundle
 * at a fraction of the size, and the geometry becomes a chunk that loads when
 * the map needs it.
 *
 * Run after `build-geo`, whose output this reads:
 *
 *   npx tsx scripts/build-region-names.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

const HERE = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = resolve(HERE, '../src/data/geo');

function main(): void {
  const topoPath = resolve(GEO_DIR, 'turkiye-ilce.topo.json');
  const topology = JSON.parse(readFileSync(topoPath, 'utf8')) as Topology;

  const object = topology.objects['ilce'];
  if (object === undefined) {
    console.error('[build-region-names] turkiye-ilce.topo.json içinde "ilce" nesnesi yok.');
    process.exit(1);
    return;
  }

  const collection = feature(topology, object) as unknown as GeoJSON.FeatureCollection;

  /*
   * A flat code→name object rather than an array of records. The parent code is
   * the first two digits, so storing it would be storing a substring of the key;
   * `ilCodeFromIlceCode` derives it at read time instead.
   */
  const names: Record<string, string> = {};
  for (const item of collection.features) {
    if (item.id === undefined || item.id === null) continue;
    const code = String(item.id);
    const raw: unknown = item.properties?.['name'];
    names[code] = typeof raw === 'string' && raw !== '' ? raw : code;
  }

  const sorted = Object.fromEntries(
    Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
  );

  const outPath = resolve(GEO_DIR, 'turkiye-ilce.names.json');
  writeFileSync(outPath, `${JSON.stringify(sorted, null, 0)}\n`);

  const sizeKb = Math.round(readFileSync(outPath).byteLength / 1024);
  const topoKb = Math.round(readFileSync(topoPath).byteLength / 1024);
  console.log(
    `[build-region-names] ${Object.keys(sorted).length} ilçe → ${outPath} `
    + `(${sizeKb} KB, ayrılan geometri ${topoKb} KB)`,
  );
}

main();
