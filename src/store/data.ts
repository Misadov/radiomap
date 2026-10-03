'use client';

import { create } from 'zustand';
import manifest from '@/data/manifest.json';
import { countryName, type Lang } from '@/lib/i18n';
import { PlaceKind, type PlacesFile, type SavedStation, type Station, type StationsFile, type StreamsFile } from '@/lib/types';

export interface CountryEntry {
  cc: string;
  count: number;
}

interface Derived {
  /** Station indices per place, ascending (= best ranked first). */
  placeStations: number[][];
  /** Station indices per country code, ascending. */
  countryStations: Map<string, number[]>;
  /** Countries by number of stations. */
  countries: CountryEntry[];
  /** "CC|Region name" -> index of the region place. */
  regionPlace: Map<string, number>;
  /** Stations per genre bit, worldwide. */
  genreCounts: Int32Array;
}

interface DataState {
  places: PlacesFile | null;
  stations: StationsFile | null;
  streams: StreamsFile | null;
  derived: Derived | null;
  idIndex: Map<string, number> | null;
  error: string | null;
  /** Bumped whenever station objects need rebuilding (streams arrived). */
  version: number;
}

export const useData = create<DataState>()(() => ({
  places: null,
  stations: null,
  streams: null,
  derived: null,
  idIndex: null,
  error: null,
  version: 0,
}));

async function getJSON<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastError;
}

function derive(places: PlacesFile, stations: StationsFile): Derived {
  const placeStations: number[][] = Array.from({ length: places.count }, () => []);
  const countryStations = new Map<string, number[]>();
  for (let i = 0; i < stations.count; i++) {
    const p = stations.place[i];
    if (p >= 0) placeStations[p].push(i);
    const cc = stations.country[i];
    if (!cc) continue;
    let list = countryStations.get(cc);
    if (!list) countryStations.set(cc, (list = []));
    list.push(i);
  }
  const countries = [...countryStations].map(([cc, list]) => ({ cc, count: list.length })).sort((a, b) => b.count - a.count);
  const genreCounts = new Int32Array(32);
  for (let i = 0; i < stations.count; i++) {
    let mask = stations.genres[i];
    while (mask) {
      const bit = 31 - Math.clz32(mask);
      genreCounts[bit]++;
      mask &= ~(1 << bit);
    }
  }
  const regionPlace = new Map<string, number>();
  for (let p = 0; p < places.count; p++) {
    if (places.kind[p] === PlaceKind.Region) regionPlace.set(`${places.country[p]}|${places.name[p]}`, p);
  }
  return { placeStations, countryStations, countries, regionPlace, genreCounts };
}

let started = false;
let streamsWaiters: ((s: StreamsFile) => void)[] = [];
let stationsWaiters: (() => void)[] = [];

export function loadData() {
  if (started) return;
  started = true;
  useData.setState({ error: null });

  const placesP = getJSON<PlacesFile>(manifest.files.places);
  const stationsP = getJSON<StationsFile>(manifest.files.stations);
  const streamsP = getJSON<StreamsFile>(manifest.files.streams);

  // Failures surface through the combined promises below.
  placesP.then((places) => useData.setState({ places })).catch(() => {});

  Promise.all([placesP, stationsP])
    .then(([places, stations]) => {
      performance.mark('radiomap:stations');
      useData.setState((s) => ({ stations, derived: derive(places, stations), version: s.version + 1 }));
      stationsWaiters.forEach((fn) => fn());
      stationsWaiters = [];
    })
    .catch(() => {
      started = false;
      useData.setState({ error: 'load' });
    });

  Promise.all([stationsP, streamsP])
    .then(([, streams]) => {
      performance.mark('radiomap:streams');
      const idIndex = new Map<string, number>();
      streams.id.forEach((id, i) => idIndex.set(id, i));
      stationCache.clear();
      useData.setState((s) => ({ streams, idIndex, version: s.version + 1 }));
      streamsWaiters.forEach((fn) => fn(streams));
      streamsWaiters = [];
    })
    .catch(() => {
      started = false;
      useData.setState({ error: 'load' });
    });
}

export function whenStreams(): Promise<StreamsFile> {
  const { streams } = useData.getState();
  if (streams) return Promise.resolve(streams);
  return new Promise((resolve) => streamsWaiters.push(resolve));
}

export function whenStations(): Promise<void> {
  if (useData.getState().stations) return Promise.resolve();
  return new Promise((resolve) => stationsWaiters.push(resolve));
}

// ------------------------------------------------------------------ stations

const stationCache = new Map<number, Station>();

export function stationAt(i: number): Station {
  const cached = stationCache.get(i);
  if (cached) return cached;
  const { stations: s, streams, places } = useData.getState();
  if (!s) throw new Error('stations not loaded');
  const p = s.place[i];
  const station: Station = {
    id: streams?.id[i] ?? '',
    index: i,
    name: s.name[i],
    favicon: s.favicon[i],
    tags: s.tags[i] ? s.tags[i].split(',') : [],
    country: s.country[i],
    language: s.language[i],
    codec: s.codec[i],
    bitrate: s.bitrate[i],
    votes: s.votes[i],
    place: p,
    placeName: p >= 0 && places ? places.name[p] : '',
    genres: s.genres[i],
    url: streams?.url[i] ?? '',
    hls: !!streams?.hls[i],
  };
  stationCache.set(i, station);
  return station;
}

export function toSaved(s: Station): SavedStation {
  return {
    id: s.id,
    name: s.name,
    favicon: s.favicon,
    country: s.country,
    placeName: s.placeName,
    tags: s.tags.slice(0, 6),
    codec: s.codec,
    bitrate: s.bitrate,
    url: s.url,
    hls: s.hls,
  };
}

/** Live dataset entry for a saved station when we have one, the saved copy otherwise. */
export function fromSaved(saved: SavedStation): Station {
  const i = useData.getState().idIndex?.get(saved.id);
  if (i !== undefined) return stationAt(i);
  return {
    id: saved.id,
    index: -1,
    name: saved.name,
    favicon: saved.favicon,
    tags: saved.tags,
    country: saved.country,
    language: '',
    codec: saved.codec,
    bitrate: saved.bitrate,
    votes: 0,
    place: -1,
    placeName: saved.placeName,
    genres: 0,
    url: saved.url,
    hls: saved.hls,
  };
}

export function stationByUuid(id: string): Station | null {
  const i = useData.getState().idIndex?.get(id);
  return i === undefined ? null : stationAt(i);
}

// -------------------------------------------------------------------- places

export function placeName(p: number, lang: Lang): string {
  const places = useData.getState().places;
  if (!places || p < 0) return '';
  return (lang === 'ru' && places.ru[p]) || places.name[p];
}

/** "Bavaria · Germany", "Germany" — the line under a place name. */
export function placeContext(p: number, lang: Lang): string {
  const places = useData.getState().places;
  if (!places || p < 0) return '';
  const region = (lang === 'ru' && places.subRu?.[p]) || places.sub[p];
  const parts = [region, countryName(places.country[p], lang)].filter(Boolean);
  return parts.join(' · ');
}

/** Where a station is, for list subtitles: "Munich", "Bavaria", or the country. */
export function stationLocation(s: Station, lang: Lang): string {
  if (s.place >= 0) return placeName(s.place, lang);
  return s.placeName || countryName(s.country, lang);
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Other places close to `p`, nearest first. */
export function nearbyPlaces(p: number, limit = 8, maxKm = 120): number[] {
  const places = useData.getState().places;
  if (!places) return [];
  const lat = places.lat[p];
  const lng = places.lng[p];
  const out: [number, number][] = [];
  for (let q = 0; q < places.count; q++) {
    if (q === p || Math.abs(places.lat[q] - lat) > 2) continue;
    const d = distanceKm(lat, lng, places.lat[q], places.lng[q]);
    if (d <= maxKm) out.push([q, d]);
  }
  return out.sort((a, b) => a[1] - b[1]).slice(0, limit).map(([q]) => q);
}

/** Nearest place to a coordinate (for "near me"). */
export function nearestPlace(lat: number, lng: number): number {
  const places = useData.getState().places;
  if (!places) return -1;
  let best = -1;
  let bestD = Infinity;
  for (let q = 0; q < places.count; q++) {
    const d = distanceKm(lat, lng, places.lat[q], places.lng[q]);
    // Prefer places with more stations when they are about as close.
    const score = d / (1 + Math.log10(places.stations[q]));
    if (score < bestD) {
      bestD = score;
      best = q;
    }
  }
  return best;
}
