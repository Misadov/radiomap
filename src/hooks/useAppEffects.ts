'use client';

import { useEffect } from 'react';
import { engine } from '@/lib/audio/engine';
import { openCountry, openPlace, playRandom } from '@/lib/actions';
import { countryName, dictionaries } from '@/lib/i18n';
import { ACHIEVEMENTS } from '@/lib/passport';
import { stationByUuid, toSaved, whenStreams } from '@/store/data';
import { importLegacyFavorites, useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Global keyboard shortcuts. */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const ui = useUI.getState();
      const player = usePlayer.getState();
      const lib = useLibrary.getState();

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('radiomap:focus-search'));
        return;
      }
      if (e.key === 'Escape') {
        if (ui.aboutOpen) return; // the dialog handles it
        if (ui.nowPlayingOpen) ui.setNowPlayingOpen(false);
        else if (ui.query) ui.setQuery('');
        else if (ui.selection) ui.back();
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      // Arrow keys belong to the map while it has focus.
      const onMap = e.target instanceof HTMLElement && !!e.target.closest('.maplibregl-map');

      switch (e.key) {
        case '/':
          e.preventDefault();
          window.dispatchEvent(new Event('radiomap:focus-search'));
          break;
        case ' ':
          if (e.target instanceof HTMLElement && e.target.closest('button,[role="button"],a')) return;
          e.preventDefault();
          player.toggle();
          break;
        case 'n':
        case 'N':
          player.step(1);
          break;
        case 'p':
        case 'P':
          player.step(-1);
          break;
        case 'r':
        case 'R':
          void playRandom();
          break;
        case 'f':
        case 'F':
          if (player.station?.id) {
            const added = lib.toggleFavorite(toSaved(player.station));
            const t = dictionaries[lib.lang];
            ui.toast(added ? t.addedFavorite : t.removedFavorite);
          }
          break;
        case 'm':
        case 'M':
          lib.setMuted(!lib.muted);
          break;
        case 'ArrowUp':
          if (onMap) return;
          e.preventDefault();
          lib.setVolume(lib.volume + 0.05);
          break;
        case 'ArrowDown':
          if (onMap) return;
          e.preventDefault();
          lib.setVolume(lib.volume - 0.05);
          break;
        case '?':
          ui.setAboutOpen(true);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** ?station=<uuid> links: show the station, ready to play (browsers block autoplay). */
export function useDeepLink() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('station');
    if (!id) return;
    let cancelled = false;
    void whenStreams().then(() => {
      if (cancelled) return;
      const station = stationByUuid(id);
      if (!station) return;
      usePlayer.getState().cue(station);
      if (station.place >= 0) openPlace(station.place);
      else if (station.country) openCountry(station.country);
      useUI.getState().toast(dictionaries[useLibrary.getState().lang].sharedWithYou);
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Polls the stream's ICY metadata ("Artist - Title") while it plays. */
export function useTrackInfo() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let forUrl = '';
    let unsupported = new Set<string>();

    const poll = async () => {
      clearTimeout(timer);
      const { station, status } = usePlayer.getState();
      if (!station?.url || status !== 'playing' || unsupported.has(station.url) || document.visibilityState !== 'visible') return;
      const url = station.url;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(`/api/now-playing?url=${encodeURIComponent(url)}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { title: string | null; supported: boolean };
          if (usePlayer.getState().station?.url !== url) return;
          if (!data.supported) unsupported.add(url);
          usePlayer.getState().setTrack(data.title || null);
        }
      } catch {
        /* network hiccup or aborted */
      }
      if (!unsupported.has(url)) timer = setTimeout(poll, 20_000);
    };

    const unsub = usePlayer.subscribe((s, prev) => {
      const url = s.station?.url ?? '';
      if (url !== forUrl) {
        forUrl = url;
        controller?.abort();
        clearTimeout(timer);
      }
      if (s.status === 'playing' && (prev.status !== 'playing' || s.station !== prev.station)) void poll();
    });
    const onVisible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      clearTimeout(timer);
      controller?.abort();
      unsupported = new Set();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

/** Misc one-time wiring: audio unlock, legacy favourites, <html lang>. */
export function useBootstrap() {
  useEffect(() => {
    importLegacyFavorites();
    const unlock = () => engine.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    const syncLang = () => (document.documentElement.lang = useLibrary.getState().lang);
    syncLang();
    const unsub = useLibrary.subscribe(syncLang);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);
}

export function useAppEffects() {
  useBootstrap();
  useHotkeys();
  useDeepLink();
  useTrackInfo();
  useRewards();
}

/** Toasts for passport milestones (new country, achievements). */
export function useRewards() {
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ country: string; newCountry: boolean; achievements: string[] }>).detail;
      const lang = useLibrary.getState().lang;
      const t = dictionaries[lang];
      if (d.newCountry && d.country) useUI.getState().toast(`🌍 ${t.newCountry(countryName(d.country, lang))}`);
      for (const id of d.achievements) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) useUI.getState().toast(`${a.icon} ${t.unlocked((lang === 'ru' ? a.ru : a.en)[0])}`);
      }
    };
    window.addEventListener('radiomap:reward', on);
    return () => window.removeEventListener('radiomap:reward', on);
  }, []);
}
