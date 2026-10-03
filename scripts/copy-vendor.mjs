// Static files the app serves from public/vendor (gitignored, rebuilt on dev/build):
//  - MapLibre GL v6 tile workers, which run as ES modules and must be real files
//  - SVG country flags (emoji flags don't render on Windows)
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'maplibre-gl');
const { version } = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'));
const outDir = path.join(root, 'public', 'vendor', 'maplibre', version);

await mkdir(outDir, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(path.join(pkgDir, 'dist', file), path.join(outDir, file));
}
console.log(`maplibre-gl ${version} workers → public/vendor/maplibre/${version}/`);

const flagsSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagsOut = path.join(root, 'public', 'vendor', 'flags');
await mkdir(flagsOut, { recursive: true });
const flags = (await readdir(flagsSrc)).filter((f) => /^[a-z]{2}\.svg$/.test(f));
await Promise.all(flags.map((f) => copyFile(path.join(flagsSrc, f), path.join(flagsOut, f))));
console.log(`${flags.length} flags → public/vendor/flags/`);
