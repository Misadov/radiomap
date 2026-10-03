'use client';

import { useData } from '@/store/data';
import { GENRES } from './genres';
import { countryName } from './i18n';
import { fold } from './text';

export interface SearchResults {
  query: string;
  places: number[];
  countries: string[];
  genres: number[];
  stations: number[];
}

interface Index {
  source: unknown;
  name: string[];
  hay: string[];
  placeName: string[];
  placeHay: string[];
  countries: { cc: string; name: string; count: number }[];
  genres: { bit: number; hay: string }[];
}

let index: Index | null = null;

function getIndex(): Index | null {
  const { stations, places, derived } = useData.getState();
  if (!stations || !places || !derived) return null;
  if (index?.source === stations) return index;

  const countryHay = new Map<string, string>();
  const countries = derived.countries.map(({ cc, count }) => {
    const name = fold(`${countryName(cc, 'en')} ${countryName(cc, 'ru')} ${cc}`);
    countryHay.set(cc, name);
    return { cc, name, count };
  });
  const genres = GENRES.map((g) => ({ bit: g.bit, hay: fold(`${g.en} ${g.ru} ${g.id}`) }));
  const genreWords = (mask: number) => {
    let out = '';
    for (const g of genres) if (mask & (1 << g.bit)) out += ` ${g.hay}`;
    return out;
  };

  const placeName = places.name.map((n, p) => fold(`${n} ${places.ru[p]}`));
  const placeHay = places.name.map((_, p) => `${placeName[p]} ${fold(places.sub[p])}`);

  const name = new Array<string>(stations.count);
  const hay = new Array<string>(stations.count);
  for (let i = 0; i < stations.count; i++) {
    const n = fold(stations.name[i]);
    const p = stations.place[i];
    name[i] = n;
    hay[i] =
      `${n} ${fold(stations.tags[i])} ${p >= 0 ? placeHay[p] : ''} ${countryHay.get(stations.country[i]) ?? ''} ` +
      `${stations.language[i]}${genreWords(stations.genres[i])}`;
  }

  index = { source: stations, name, hay, placeName, placeHay, countries, genres };
  return index;
}

/** Build the index during idle time so the first keystroke is instant. */
export function warmSearch() {
  const run = () => getIndex();
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 500);
}

const EMPTY: SearchResults = { query: '', places: [], countries: [], genres: [], stations: [] };

export function search(raw: string, limit = 120): SearchResults {
  const q = fold(raw).replace(/\s+/g, ' ').trim();
  if (!q) return EMPTY;
  const idx = getIndex();
  const { places } = useData.getState();
  if (!idx || !places) return { ...EMPTY, query: q };
  const tokens = q.split(' ');
  const matchAll = (h: string) => tokens.every((t) => h.includes(t));

  // Stations — the array is already in rank order, so popular matches come first.
  const total = idx.name.length;
  const hits: [number, number][] = [];
  for (let i = 0; i < total; i++) {
    if (!matchAll(idx.hay[i])) continue;
    const n = idx.name[i];
    let score = n === q ? 120 : n.startsWith(q) ? 80 : n.includes(` ${q}`) ? 56 : n.includes(q) ? 40 : 0;
    if (!score) for (const t of tokens) score += n.includes(t) ? 12 : 3;
    score += 32 * (1 - i / total);
    hits.push([i, score]);
    if (hits.length >= 4000) break;
  }
  hits.sort((a, b) => b[1] - a[1]);

  const placeHits: [number, number][] = [];
  for (let p = 0; p < places.count; p++) {
    if (!matchAll(idx.placeHay[p])) continue;
    const n = idx.placeName[p];
    const score = (n.startsWith(q) ? 60 : n.includes(q) ? 35 : 15) + Math.log2(1 + places.stations[p]) * 5;
    placeHits.push([p, score]);
  }
  placeHits.sort((a, b) => b[1] - a[1]);

  const countries = idx.countries
    .filter((c) => matchAll(c.name) || c.cc.toLowerCase() === q)
    .map((c) => [c.cc, (c.name.startsWith(q) ? 50 : 20) + Math.log2(1 + c.count) * 4] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cc]) => cc);

  const genres = q.length < 2 ? [] : idx.genres.filter((g) => g.hay.split(' ').some((w) => w.startsWith(q))).map((g) => g.bit).slice(0, 3);

  return {
    query: q,
    places: placeHits.slice(0, 6).map(([p]) => p),
    countries,
    genres,
    stations: hits.slice(0, limit).map(([i]) => i),
  };
}
