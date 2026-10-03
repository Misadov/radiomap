// Downloads and parses the GeoNames gazetteer (https://www.geonames.org, CC BY 4.0).
// Everything is cached under .cache/geonames so repeated builds stay offline.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Unzip, UnzipInflate, unzipSync, strFromU8 } from 'fflate';

const BASE = 'https://download.geonames.org/export/dump/';
const MAX_AGE_DAYS = 45;

// Populated-place feature codes we never want to snap to: neighbourhoods,
// historical, abandoned or destroyed places.
const SKIP_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

// alternateNames "languages" that are really identifiers, not names.
const NON_NAMES = new Set(['link', 'wkdt', 'post', 'iata', 'icao', 'faac', 'unlc', 'tcid', 'fr_1793', 'phon', 'piny']);

async function isFresh(file) {
  try {
    const s = await stat(file);
    return Date.now() - s.mtimeMs < MAX_AGE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

async function download(name, dir, { offline, log }) {
  const file = path.join(dir, name);
  if (offline || (await isFresh(file))) return readFile(file);
  log(`  ↓ ${name}`);
  const res = await fetch(BASE + name, { signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`GeoNames ${name}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

function* tsv(text) {
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    yield line.split('\t');
  }
}

/** Streams alternateNamesV2.zip (~200 MB) and keeps only what we need. */
async function extractAlternateNames(admin1Ids, cityIds, log) {
  log('  ↓ alternateNamesV2.zip (streamed, ~200 MB)');
  const res = await fetch(BASE + 'alternateNamesV2.zip', { signal: AbortSignal.timeout(1_800_000) });
  if (!res.ok) throw new Error(`GeoNames alternateNamesV2.zip: ${res.status}`);

  const admin1Names = {}; // geonameid -> string[] (all languages, for matching)
  const ru = {}; // geonameid -> [name, score]

  const handle = (line) => {
    const c = line.split('\t');
    const id = c[1];
    const lang = c[2];
    if (NON_NAMES.has(lang)) return;
    const isAdmin1 = admin1Ids.has(id);
    if (isAdmin1) (admin1Names[id] ??= []).push(c[3]);
    if (lang === 'ru' && (isAdmin1 || cityIds.has(id))) {
      if (c[6] === '1' || c[7] === '1') return; // colloquial / historic
      const score = (c[4] === '1' ? 2 : 0) + (c[5] === '1' ? 1 : 0);
      if (!ru[id] || ru[id][1] < score) ru[id] = [c[3], score];
    }
  };

  await new Promise((resolve, reject) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      if (file.name !== 'alternateNamesV2.txt') return;
      const decoder = new TextDecoder();
      let rest = '';
      file.ondata = (err, chunk, final) => {
        if (err) return reject(err);
        const text = rest + decoder.decode(chunk, { stream: !final });
        const lines = text.split('\n');
        rest = final ? '' : lines.pop();
        for (const line of lines) if (line) handle(line);
        if (final) resolve();
      };
      file.start();
    };
    (async () => {
      for await (const chunk of res.body) unzip.push(chunk);
      unzip.push(new Uint8Array(0), true);
    })().catch(reject);
  });

  return {
    admin1Names,
    ru: Object.fromEntries(Object.entries(ru).map(([id, [name]]) => [id, name])),
  };
}

export async function loadGeoNames({ cacheDir, offline = false, log = console.log }) {
  const dir = path.join(cacheDir, 'geonames');
  await mkdir(dir, { recursive: true });

  const [citiesZip, admin1Txt, countryTxt] = await Promise.all([
    download('cities1000.zip', dir, { offline, log }),
    download('admin1CodesASCII.txt', dir, { offline, log }),
    download('countryInfo.txt', dir, { offline, log }),
  ]);

  const countries = new Map();
  for (const c of tsv(countryTxt.toString('utf8'))) {
    countries.set(c[0], { cc: c[0], name: c[4], capital: c[5], population: +c[7] || 0 });
  }

  const admin1 = new Map();
  for (const c of tsv(admin1Txt.toString('utf8'))) {
    const [cc] = c[0].split('.');
    admin1.set(c[0], { code: c[0], cc, name: c[1], ascii: c[2], id: c[3], alts: [], ru: null });
  }

  const citiesText = strFromU8(unzipSync(new Uint8Array(citiesZip), {
    filter: (f) => f.name === 'cities1000.txt',
  })['cities1000.txt']);

  const cities = [];
  for (const c of tsv(citiesText)) {
    if (SKIP_FEATURES.has(c[7])) continue;
    cities.push({
      id: c[0],
      name: c[1],
      ascii: c[2],
      alts: c[3] ? c[3].split(',') : [],
      lat: +c[4],
      lng: +c[5],
      fcode: c[7],
      cc: c[8],
      a1: `${c[8]}.${c[10]}`,
      pop: +c[14] || 0,
      ru: null,
    });
  }

  // alternateNames subset is cached as JSON (the source file is huge).
  const altCache = path.join(dir, 'alternate-names-subset.json');
  let alt;
  if (offline || (await isFresh(altCache))) {
    alt = JSON.parse(await readFile(altCache, 'utf8'));
  } else {
    alt = await extractAlternateNames(
      new Set([...admin1.values()].map((a) => a.id)),
      new Set(cities.map((c) => c.id)),
      log,
    );
    await writeFile(altCache, JSON.stringify(alt));
  }

  for (const a of admin1.values()) {
    a.alts = alt.admin1Names[a.id] ?? [];
    a.ru = alt.ru[a.id] ?? null;
  }
  for (const city of cities) city.ru = alt.ru[city.id] ?? null;

  log(`  · ${cities.length.toLocaleString('en')} cities, ${admin1.size.toLocaleString('en')} regions, ${countries.size} countries`);
  return { cities, admin1, countries };
}
