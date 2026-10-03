'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Lang } from '@/lib/i18n';
import type { SavedStation } from '@/lib/types';

const MAX_RECENTS = 60;

/** First-visit language: Russian for ru/be/uk/kk browsers, English otherwise. */
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => /^(ru|be|uk|kk)\b/i.test(l)) ? 'ru' : 'en';
}

export interface RecentEntry {
  station: SavedStation;
  at: number;
}

interface LibraryState {
  lang: Lang;
  volume: number;
  muted: boolean;
  favorites: SavedStation[];
  recents: RecentEntry[];
  legacyImported: boolean;

  setLang: (lang: Lang) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleFavorite: (station: SavedStation) => boolean;
  addFavorites: (stations: SavedStation[]) => number;
  removeFavorite: (id: string) => void;
  addRecent: (station: SavedStation) => void;
  clearRecents: () => void;
  refreshSaved: (fresh: Map<string, SavedStation>) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      lang: detectLang(),
      volume: 0.8,
      muted: false,
      favorites: [],
      recents: [],
      legacyImported: false,

      setLang: (lang) => set({ lang }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: false }),
      setMuted: (muted) => set({ muted }),

      toggleFavorite: (station) => {
        const exists = get().favorites.some((f) => f.id === station.id);
        set((s) => ({
          favorites: exists ? s.favorites.filter((f) => f.id !== station.id) : [station, ...s.favorites],
        }));
        return !exists;
      },

      addFavorites: (stations) => {
        const known = new Set(get().favorites.map((f) => f.id));
        const fresh = stations.filter((s) => s.id && !known.has(s.id) && known.add(s.id));
        if (fresh.length) set((s) => ({ favorites: [...s.favorites, ...fresh] }));
        return fresh.length;
      },

      removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      addRecent: (station) =>
        set((s) => ({
          recents: [{ station, at: Date.now() }, ...s.recents.filter((r) => r.station.id !== station.id)].slice(0, MAX_RECENTS),
        })),

      clearRecents: () => set({ recents: [] }),

      /** Swap stored copies for fresh ones (new stream urls, logos) after the dataset loads. */
      refreshSaved: (fresh) =>
        set((s) => ({
          favorites: s.favorites.map((f) => fresh.get(f.id) ?? f),
          recents: s.recents.map((r) => {
            const f = fresh.get(r.station.id);
            return f ? { ...r, station: f } : r;
          }),
        })),
    }),
    {
      name: 'radiomap:v2',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lang: s.lang,
        volume: s.volume,
        muted: s.muted,
        favorites: s.favorites,
        recents: s.recents,
        legacyImported: s.legacyImported,
      }),
    },
  ),
);

export function useIsFavorite(id: string | undefined) {
  return useLibrary((s) => !!id && s.favorites.some((f) => f.id === id));
}

interface LegacyStation {
  stationuuid?: string;
  name?: string;
  favicon?: string;
  countrycode?: string;
  state?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  url?: string;
  url_resolved?: string;
  hls?: number;
}

/** Accepts both the v1 export format ({ stations: [...] }) and our own export. */
export function parseFavoritesFile(json: unknown): SavedStation[] {
  const list: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { stations?: unknown[] }).stations)
      ? (json as { stations: unknown[] }).stations
      : json && typeof json === 'object' && Array.isArray((json as { favorites?: unknown[] }).favorites)
        ? (json as { favorites: unknown[] }).favorites
        : [];
  const out: SavedStation[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const v2 = item as Partial<SavedStation>;
    if (typeof v2.id === 'string' && typeof v2.url === 'string' && typeof v2.name === 'string') {
      out.push({
        id: v2.id,
        name: v2.name,
        favicon: v2.favicon ?? '',
        country: v2.country ?? '',
        placeName: v2.placeName ?? '',
        tags: Array.isArray(v2.tags) ? v2.tags.filter((t) => typeof t === 'string') : [],
        codec: v2.codec ?? '',
        bitrate: Number(v2.bitrate) || 0,
        url: v2.url,
        hls: !!v2.hls,
      });
      continue;
    }
    const v1 = item as LegacyStation;
    const url = v1.url_resolved || v1.url;
    if (!v1.stationuuid || !url || !v1.name) continue;
    out.push({
      id: v1.stationuuid,
      name: v1.name.trim(),
      favicon: v1.favicon ?? '',
      country: v1.countrycode ?? '',
      placeName: v1.state ?? '',
      tags: (v1.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
      codec: v1.codec ?? '',
      bitrate: Number(v1.bitrate) || 0,
      url,
      hls: !!v1.hls,
    });
  }
  return out;
}

/** One-time import of favourites saved by RadioMap v1 (key "radiomap_favorites"). */
export function importLegacyFavorites() {
  const state = useLibrary.getState();
  if (state.legacyImported) return;
  try {
    const raw = localStorage.getItem('radiomap_favorites');
    if (raw) state.addFavorites(parseFavoritesFile(JSON.parse(raw)));
  } catch {
    /* ignore corrupt legacy data */
  }
  useLibrary.setState({ legacyImported: true });
}
