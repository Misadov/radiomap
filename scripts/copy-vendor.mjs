// Static files the app serves from public/vendor (gitignored, rebuilt on every dev/build
// start — called from next.config.ts, so it runs whatever command starts Next):
//  - MapLibre GL v6 tile workers, which run as ES modules and must be real files
//  - SVG country flags (emoji flags don't render on Windows)
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function copyVendor({ quiet = false } = {}) {
  const pkgDir = path.join(root, 'node_modules', 'maplibre-gl');
  const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const outDir = path.join(root, 'public', 'vendor', 'maplibre', version);
  mkdirSync(outDir, { recursive: true });
  for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
    copyFileSync(path.join(pkgDir, 'dist', file), path.join(outDir, file));
  }

  const flagsSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
  const flagsOut = path.join(root, 'public', 'vendor', 'flags');
  mkdirSync(flagsOut, { recursive: true });
  const flags = readdirSync(flagsSrc).filter((f) => /^[a-z]{2}\.svg$/.test(f));
  for (const f of flags) copyFileSync(path.join(flagsSrc, f), path.join(flagsOut, f));

  if (!quiet) console.log(`vendor: maplibre-gl ${version} workers, ${flags.length} flags → public/vendor/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) copyVendor();
