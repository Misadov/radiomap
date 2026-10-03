#!/usr/bin/env node
// Builds the datasets the app ships with:
//   public/data/places.<hash>.json    every dot on the globe (cities, regions)
//   public/data/stations.<hash>.json  station metadata, columnar, sorted by rank
//   public/data/streams.<hash>.json   ids + stream urls, same order (needed to play)
//   src/data/manifest.json            file names + counts, imported by the app
//
//   npm run data                  fetch stations (cached 12h) + GeoNames (cached 45d)
//   npm run data -- --offline     rebuild from .cache only
//   npm run data -- --refresh     ignore the station cache
//
// Station data: radio-browser.info (public domain). Places: GeoNames (CC BY 4.0).

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGeocoder, PRECISION } from './lib/geocode.mjs';
import { genreMask } from './lib/genres.mjs';
import { loadGeoNames } from './lib/geonames.mjs';
import { fetchAllStations } from './lib/radio-browser.mjs';
import { clean, haversineKm, isHttpUrl, key, round } from './lib/text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const MANIFEST = path.join(ROOT, 'src', 'data', 'manifest.json');
const STATION_CACHE_HOURS = 12;

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const refresh = args.has('--refresh');
const log = (...m) => console.log(...m);
const fmt = (n) => n.toLocaleString('en');

// ---------------------------------------------------------------------------------
// 1. Load raw data
// ---------------------------------------------------------------------------------

async function loadStations() {
  const file = path.join(CACHE, 'stations.json');
  try {
    const s = await stat(file);
    const fresh = Date.now() - s.mtimeMs < STATION_CACHE_HOURS * 3_600_000;
    if (offline || (fresh && !refresh)) {
      log('• stations: using .cache/stations.json');
      return JSON.parse(await readFile(file, 'utf8'));
    }
  } catch {
    if (offline) throw new Error('--offline but .cache/stations.json is missing');
  }
  log('• stations: fetching from radio-browser.info');
  const stations = await fetchAllStations(log);
  await writeFile(file, JSON.stringify(stations));
  return stations;
}

// ---------------------------------------------------------------------------------
// 2. Normalise
// ---------------------------------------------------------------------------------

const JUNK_TAG = /https?:|www\.|@|^\d+$|^[^\p{L}]+$/u;

function normaliseTags(raw, name, country) {
  const out = [];
  const nameKey = key(name);
  for (const part of String(raw ?? '').split(',')) {
    const tag = clean(part).toLowerCase();
    if (!tag || tag.length > 24 || JUNK_TAG.test(tag)) continue;
    const k = key(tag);
    if (!k || k === nameKey || k === country) continue;
    if (!out.some((t) => key(t) === k)) out.push(tag);
  }
  return out;
}

function normaliseUrl(url) {
  return url.trim().replace(/^https?:\/\//i, '').replace(/[/?#]+$/, '').toLowerCase();
}

function toStation(raw, countryNames) {
  const name = clean(raw.name);
  const url = clean(raw.url_resolved) || clean(raw.url);
  if (!name || !isHttpUrl(url)) return null;
  const codec = clean(raw.codec).toUpperCase();
  if (/H\.264|H264|FLV/.test(codec)) return null; // video streams

  const cc = /^[A-Za-z]{2}$/.test(raw.countrycode ?? '') ? raw.countrycode.toUpperCase() : '';
  const lat = typeof raw.geo_lat === 'number' ? raw.geo_lat : NaN;
  const lng = typeof raw.geo_long === 'number' ? raw.geo_long : NaN;
  const favicon = clean(raw.favicon);
  const homepage = clean(raw.homepage);

  return {
    id: raw.stationuuid,
    name,
    url,
    https: /^https:/i.test(url),
    favicon: isHttpUrl(favicon) ? favicon : '',
    homepage: isHttpUrl(homepage) ? homepage : '',
    tags: normaliseTags(raw.tags, name, key(countryNames.get(cc) ?? '')),
    cc,
    state: clean(raw.state),
    language: clean(String(raw.language ?? '').split(',')[0]).toLowerCase(),
    codec: codec === 'UNKNOWN' ? '' : codec,
    bitrate: Number(raw.bitrate) || 0,
    hls: raw.hls ? 1 : 0,
    votes: Math.max(0, Number(raw.votes) || 0),
    clicks: Math.max(0, Number(raw.clickcount) || 0),
    sslError: raw.ssl_error ? 1 : 0,
    lat,
    lng,
  };
}

const hasCoords = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat === 0 && s.lng === 0);

function quality(s) {
  return (
    Math.log10(1 + s.votes) +
    0.6 * Math.log10(1 + s.clicks) +
    (s.https ? 0.6 : 0) +
    (s.favicon ? 0.2 : 0) +
    (s.codec ? 0 : -0.2) -
    (s.sslError ? 0.3 : 0)
  );
}

/** Folds `other` into `best` (best keeps its identity and stream). */
function absorb(best, other) {
  best.votes = Math.max(best.votes, other.votes);
  best.clicks += other.clicks;
  if (!best.favicon && other.favicon) best.favicon = other.favicon;
  if (!best.homepage && other.homepage) best.homepage = other.homepage;
  if (!best.state && other.state) best.state = other.state;
  if (!best.language && other.language) best.language = other.language;
  if (!hasCoords(best) && hasCoords(other)) {
    best.lat = other.lat;
    best.lng = other.lng;
  }
  for (const t of other.tags) if (best.tags.length < 8 && !best.tags.includes(t)) best.tags.push(t);
}

function dedupe(stations) {
  // a) identical streams
  const byUrl = new Map();
  for (const s of stations) {
    const k = normaliseUrl(s.url);
    (byUrl.get(k) ?? byUrl.set(k, []).get(k)).push(s);
  }
  const unique = [];
  for (const group of byUrl.values()) {
    group.sort((a, b) => quality(b) - quality(a));
    const [best, ...rest] = group;
    const secure = group.find((s) => s.https);
    if (secure && !best.https) {
      best.url = secure.url;
      best.https = true;
    }
    for (const r of rest) absorb(best, r);
    unique.push(best);
  }

  // b) same station listed with different streams: same name + country,
  //    unless they clearly belong to different places.
  const byName = new Map();
  for (const s of unique) {
    const k = `${s.cc}|${key(s.name)}`;
    (byName.get(k) ?? byName.set(k, []).get(k)).push(s);
  }
  const out = [];
  for (const group of byName.values()) {
    group.sort((a, b) => quality(b) - quality(a));
    const leaders = [];
    for (const s of group) {
      const leader = leaders.find(
        (l) =>
          (!l.state || !s.state || key(l.state) === key(s.state)) &&
          (!hasCoords(l) || !hasCoords(s) || haversineKm(l.lat, l.lng, s.lat, s.lng) < 50),
      );
      if (leader) absorb(leader, s);
      else leaders.push(s);
    }
    out.push(...leaders);
  }
  return out;
}

// ---------------------------------------------------------------------------------
// 3. Places
// ---------------------------------------------------------------------------------

function buildPlaces(stations, geocoder, countries) {
  const places = new Map();
  const stats = Object.fromEntries(Object.keys(PRECISION).map((k) => [k, 0]));
  const precisionName = Object.fromEntries(Object.entries(PRECISION).map(([k, v]) => [v, k]));

  for (const s of stations) {
    const hit = geocoder.locate(s);
    s.precision = hit.precision;
    stats[precisionName[hit.precision]]++;
    let placeKey = null;
    let make = null;

    if (hit.type === 'city') {
      const c = hit.city;
      placeKey = `c${c.id}`;
      make = () => ({
        kind: 0,
        name: c.name,
        ru: c.ru,
        sub: geocoder.regions.get(c.a1)?.name ?? '',
        subRu: geocoder.regions.get(c.a1)?.ru ?? '',
        cc: c.cc,
        lat: c.lat,
        lng: c.lng,
        pop: c.pop,
      });
    } else if (hit.type === 'region') {
      const r = hit.region;
      placeKey = `r${r.code}`;
      make = () => ({ kind: 1, name: r.name, ru: r.ru, sub: '', cc: r.cc, lat: r.lat, lng: r.lng, pop: r.pop });
    } else if (hit.type === 'point') {
      placeKey = `p${round(hit.lat, 1)}:${round(hit.lng, 1)}`;
      const label = hit.near ?? null;
      make = () => ({
        kind: 2,
        name: label?.name ?? hit.region?.name ?? countries.get(s.cc)?.name ?? '',
        ru: label?.ru ?? hit.region?.ru ?? null,
        sub: hit.region?.name ?? '',
        subRu: hit.region?.ru ?? '',
        cc: s.cc || label?.cc || '',
        lat: 0,
        lng: 0,
        pop: 0,
        points: [],
      });
    }

    if (!placeKey) {
      s.placeKey = null;
      continue;
    }
    let place = places.get(placeKey);
    if (!place) places.set(placeKey, (place = make()));
    if (place.points) place.points.push([s.lat, s.lng]);
    s.placeKey = placeKey;
  }

  for (const p of places.values()) {
    if (!p.points) continue;
    p.lat = p.points.reduce((a, [lat]) => a + lat, 0) / p.points.length;
    p.lng = p.points.reduce((a, [, lng]) => a + lng, 0) / p.points.length;
    delete p.points;
  }

  return { places, stats };
}

// ---------------------------------------------------------------------------------
// 4. Output
// ---------------------------------------------------------------------------------

function hashOf(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 10);
}

async function writeHashed(base, payload) {
  const text = JSON.stringify(payload);
  const name = `${base}.${hashOf(text)}.json`;
  await writeFile(path.join(OUT_DIR, name), text);
  return { name, bytes: Buffer.byteLength(text) };
}

async function main() {
  const t0 = Date.now();
  await mkdir(CACHE, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const raw = await loadStations();
  log(`  · ${fmt(raw.length)} raw stations`);

  log('• geonames');
  const geo = await loadGeoNames({ cacheDir: CACHE, offline, log });
  const countryNames = new Map([...geo.countries].map(([cc, c]) => [cc, c.name]));
  const geocoder = createGeocoder(geo);

  log('• normalising & de-duplicating');
  const normalised = raw.map((r) => toStation(r, countryNames)).filter(Boolean);
  const stations = dedupe(normalised);
  log(`  · ${fmt(normalised.length)} playable → ${fmt(stations.length)} unique`);

  log('• geocoding');
  const { places, stats } = buildPlaces(stations, geocoder, geo.countries);
  for (const [k, v] of Object.entries(stats)) log(`  · ${k.padEnd(16)} ${fmt(v).padStart(7)}  (${((v / stations.length) * 100).toFixed(1)}%)`);

  // Rank: most popular & most likely to play first. Array order == rank order.
  for (const s of stations) s.score = quality(s);
  stations.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Places: biggest first; drop nothing, but index by order of appearance.
  const placeCounts = new Map();
  for (const s of stations) if (s.placeKey) placeCounts.set(s.placeKey, (placeCounts.get(s.placeKey) ?? 0) + 1);
  const placeKeys = [...placeCounts.keys()].sort((a, b) => placeCounts.get(b) - placeCounts.get(a));
  const placeIndex = new Map(placeKeys.map((k, i) => [k, i]));

  const placeList = placeKeys.map((k) => places.get(k));
  const placesOut = {
    version: 2,
    count: placeList.length,
    lng: placeList.map((p) => round(p.lng, 3)),
    lat: placeList.map((p) => round(p.lat, 3)),
    name: placeList.map((p) => p.name),
    ru: placeList.map((p) => (p.ru && p.ru !== p.name ? p.ru : '')),
    // "Berlin, State of Berlin" -> just "Berlin".
    sub: placeList.map((p) => (p.sub && !key(p.sub).includes(key(p.name)) ? p.sub : '')),
    subRu: placeList.map((p) => (p.sub && p.subRu && !key(p.sub).includes(key(p.name)) ? p.subRu : '')),
    country: placeList.map((p) => p.cc),
    kind: placeList.map((p) => p.kind),
    stations: placeKeys.map((k) => placeCounts.get(k)),
  };

  const stationsOut = {
    version: 2,
    count: stations.length,
    name: stations.map((s) => s.name),
    favicon: stations.map((s) => s.favicon),
    tags: stations.map((s) => s.tags.slice(0, 6).join(',')),
    country: stations.map((s) => s.cc),
    language: stations.map((s) => s.language),
    codec: stations.map((s) => s.codec),
    bitrate: stations.map((s) => s.bitrate),
    hls: stations.map((s) => s.hls),
    votes: stations.map((s) => s.votes),
    place: stations.map((s) => (s.placeKey ? placeIndex.get(s.placeKey) : -1)),
    precision: stations.map((s) => s.precision),
    genres: stations.map((s) => genreMask(s.tags.map(key))),
  };

  const streamsOut = {
    version: 2,
    count: stations.length,
    id: stations.map((s) => s.id),
    url: stations.map((s) => s.url),
    hls: stations.map((s) => s.hls),
  };

  // Replace previous outputs.
  for (const f of await readdir(OUT_DIR)) {
    if (/^(places|stations|streams)\.[0-9a-f]+\.json$/.test(f)) await rm(path.join(OUT_DIR, f));
  }
  const placesFile = await writeHashed('places', placesOut);
  const stationsFile = await writeHashed('stations', stationsOut);
  const streamsFile = await writeHashed('streams', streamsOut);

  const countries = new Set(stations.map((s) => s.cc).filter(Boolean));
  const manifest = {
    generated: new Date().toISOString(),
    stations: stations.length,
    places: placeList.length,
    countries: countries.size,
    onMap: stations.filter((s) => s.placeKey).length,
    files: {
      places: `/data/${placesFile.name}`,
      stations: `/data/${stationsFile.name}`,
      streams: `/data/${streamsFile.name}`,
    },
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  log('• wrote');
  log(`  · ${placesFile.name}  ${(placesFile.bytes / 1024).toFixed(0)} KB, ${fmt(placeList.length)} places`);
  log(`  · ${stationsFile.name}  ${(stationsFile.bytes / 1024 / 1024).toFixed(2)} MB, ${fmt(stations.length)} stations`);
  log(`  · ${streamsFile.name}  ${(streamsFile.bytes / 1024 / 1024).toFixed(2)} MB`);
  log(`  · ${fmt(manifest.onMap)} stations on the map, ${countries.size} countries`);
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
