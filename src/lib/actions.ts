'use client';

import { mapBus } from './map-bus';
import { nearestPlace, stationAt, useData, whenStations } from '@/store/data';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { useLibrary } from '@/store/library';

/** On phones, reveal the map behind the sheet and drop the keyboard. */
function revealMap() {
  if (!window.matchMedia('(max-width: 767px)').matches) return;
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (useUI.getState().sheet !== 'half') useUI.getState().setSheet('half');
}

export function openPlace(place: number, opts: { push?: boolean; fly?: boolean } = {}) {
  useUI.getState().select({ kind: 'place', place }, { push: opts.push });
  revealMap();
  if (opts.fly !== false) mapBus.send({ type: 'fly-place', place });
}

export function openCountry(cc: string, opts: { push?: boolean; fly?: boolean } = {}) {
  useUI.getState().select({ kind: 'country', cc }, { push: opts.push });
  revealMap();
  if (opts.fly !== false) mapBus.send({ type: 'fly-country', cc });
}

/** "Surprise me": fly to a random well-ranked station somewhere on the globe and play it. */
export async function playRandom(opts: { newCountry?: boolean } = {}) {
  await whenStations();
  const { stations, places } = useData.getState();
  if (!stations || !places) return;
  const genre = useUI.getState().genre;
  const bit = genre < 0 ? 0 : 1 << genre;
  const pool: number[] = [];
  const current = usePlayer.getState().station;
  const visited = opts.newCountry ? useLibrary.getState().passport.countries : null;
  for (let i = 0; i < stations.count && pool.length < 6000; i++) {
    if (stations.place[i] < 0 || (bit && !(stations.genres[i] & bit))) continue;
    if (current && current.index === i) continue;
    if (visited && visited[stations.country[i]]) continue;
    pool.push(i);
  }
  if (!pool.length) return;
  const i = pool[Math.floor(Math.random() * pool.length)];
  const station = stationAt(i);
  openPlace(station.place);
  void usePlayer.getState().play(station, useData.getState().derived?.placeStations[station.place]);
}

/** "Near me": ask for the position and open the closest place. */
export function locateMe(onError: () => void) {
  if (!('geolocation' in navigator)) return onError();
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await whenStations();
      const { latitude, longitude } = pos.coords;
      const p = nearestPlace(latitude, longitude);
      if (p >= 0) openPlace(p);
      else mapBus.send({ type: 'fly-to', lng: longitude, lat: latitude, zoom: 7 });
    },
    onError,
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
  );
}
