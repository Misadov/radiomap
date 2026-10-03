'use client';

import type { Station } from './types';
import { distanceKm, useData } from '@/store/data';

/** Stations sharing the main genre, preferring ones close by; best ranked first. */
export function similarStations(station: Station, limit = 6): number[] {
  const { stations, places } = useData.getState();
  if (!stations || !places) return [];
  const mask = station.genres;
  const main = mask ? 31 - Math.clz32(mask & -mask) : -1; // lowest set bit = first genre in display order
  const bit = main >= 0 ? 1 << main : 0;
  const here = station.place >= 0 ? [places.lat[station.place], places.lng[station.place]] : null;

  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < stations.count && near.length < limit; i++) {
    if (i === station.index) continue;
    if (bit ? !(stations.genres[i] & bit) : stations.country[i] !== station.country) continue;
    const p = stations.place[i];
    const close =
      (station.country && stations.country[i] === station.country) ||
      (here && p >= 0 && distanceKm(here[0], here[1], places.lat[p], places.lng[p]) < 900);
    if (close) near.push(i);
    else if (far.length < limit) far.push(i);
  }
  return [...near, ...far].slice(0, limit);
}

export function trackSearchLinks(track: string) {
  const q = encodeURIComponent(track);
  return [
    { id: 'ytm', label: 'YouTube Music', href: `https://music.youtube.com/search?q=${q}` },
    { id: 'spotify', label: 'Spotify', href: `https://open.spotify.com/search/${q}` },
    { id: 'apple', label: 'Apple Music', href: `https://music.apple.com/search?term=${q}` },
  ];
}
