'use client';

import { create } from 'zustand';
import { engine, type EngineError, type EngineStatus } from '@/lib/audio/engine';
import { clickStation } from '@/lib/radio-browser';
import type { Station } from '@/lib/types';
import { placeName, stationAt, toSaved, useData, whenStreams } from './data';
import { useLibrary } from './library';
import { useUI } from './ui';

interface PlayerState {
  station: Station | null;
  status: EngineStatus;
  error: EngineError | null;
  /** "Artist - Title" from the stream's ICY metadata, when available. */
  track: string | null;
  /** Real spectrum data available (vs. ambient animation). */
  analysis: boolean;
  /** The list the current station was started from; drives next / previous. */
  queue: number[];

  play: (station: Station, queue?: number[]) => Promise<void>;
  /** Load a station without starting it (shared links: autoplay needs a click). */
  cue: (station: Station) => void;
  toggle: () => void;
  stop: () => void;
  step: (dir: 1 | -1) => void;
  setTrack: (track: string | null) => void;
}

interface Attempt {
  station: Station;
  fresh: Promise<string | null>;
  retried: boolean;
}

let attempt: Attempt | null = null;

const sameStream = (a: string, b: string) =>
  a.replace(/^https?:\/\//i, '').replace(/\/+$/, '') === b.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

function syncUrl(station: Station | null) {
  const url = new URL(window.location.href);
  if (station?.id) url.searchParams.set('station', station.id);
  else url.searchParams.delete('station');
  window.history.replaceState(window.history.state, '', url);
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  station: null,
  status: 'idle',
  error: null,
  track: null,
  analysis: false,
  queue: [],

  play: async (input, queue) => {
    let station = input;
    set({ station, status: 'loading', error: null, track: null, ...(queue ? { queue } : {}) });

    if (!station.url && station.index >= 0) {
      await whenStreams();
      if (get().station !== input) return; // user moved on meanwhile
      station = stationAt(station.index);
      set({ station });
    }
    if (!station.url) {
      set({ status: 'error', error: 'unavailable' });
      return;
    }

    syncUrl(station);
    attempt = { station, fresh: station.id ? clickStation(station.id) : Promise.resolve(null), retried: false };
    void engine.play({ url: station.url, hls: station.hls });
  },

  cue: (station) => {
    engine.stop();
    attempt = null;
    set({ station, status: 'paused', error: null, track: null });
  },

  toggle: () => {
    const { status, station } = get();
    if (!station) return;
    if (status === 'playing' || status === 'loading') engine.pause();
    else if (status === 'paused' && attempt?.station === station) engine.resume();
    else void get().play(station);
  },

  stop: () => {
    engine.stop();
    attempt = null;
    syncUrl(null);
    set({ station: null, status: 'idle', error: null, track: null, analysis: false });
  },

  step: (dir) => {
    const { station, queue } = get();
    let list = queue.length > 1 ? queue : (useUI.getState().inView ?? []);
    if (list.length < 2) {
      const count = useData.getState().stations?.count ?? 0;
      list = Array.from({ length: Math.min(300, count) }, (_, i) => i);
    }
    if (!list.length) return;
    const pos = station ? list.indexOf(station.index) : -1;
    const next = list[(pos + dir + list.length) % list.length];
    void get().play(stationAt(next), list);
  },

  setTrack: (track) => set({ track }),
}));

// ------------------------------------------------------------ engine wiring

if (typeof window !== 'undefined') {
  engine.on('status', (status) => {
    if (status === 'error') return; // handled below, possibly with a retry
    usePlayer.setState({ status, ...(status === 'playing' ? { error: null } : {}) });
    if (status === 'playing' && attempt) {
      const saved = toSaved(attempt.station);
      if (saved.id) useLibrary.getState().addRecent(saved);
    }
  });

  engine.on('analysis', (analysis) => usePlayer.setState({ analysis }));

  engine.on('error', async (error) => {
    const current = attempt;
    if (current && !current.retried) {
      current.retried = true;
      // Our snapshot of the directory may be stale: ask radio-browser for the current url.
      const fresh = await current.fresh;
      if (current !== attempt) return;
      if (fresh && !sameStream(fresh, current.station.url)) {
        usePlayer.setState({ status: 'loading', error: null });
        void engine.play({ url: fresh, hls: current.station.hls || /\.m3u8/i.test(fresh) });
        return;
      }
    }
    usePlayer.setState({ status: 'error', error });
  });

  const applyVolume = () => {
    const { volume, muted } = useLibrary.getState();
    engine.setVolume(volume, muted);
  };
  applyVolume();
  useLibrary.subscribe(applyVolume);

  // OS media controls, lock screen, headphones buttons.
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    };
    safe('play', () => usePlayer.getState().toggle());
    safe('pause', () => usePlayer.getState().toggle());
    safe('stop', () => usePlayer.getState().stop());
    safe('nexttrack', () => usePlayer.getState().step(1));
    safe('previoustrack', () => usePlayer.getState().step(-1));

    usePlayer.subscribe((s, prev) => {
      if (s.station !== prev.station || s.track !== prev.track) {
        if (!s.station) {
          ms.metadata = null;
        } else {
          const lang = useLibrary.getState().lang;
          const where = s.station.place >= 0 ? placeName(s.station.place, lang) : s.station.placeName;
          ms.metadata = new MediaMetadata({
            title: s.track || s.station.name,
            artist: s.track ? s.station.name : where || 'RadioMap',
            album: 'RadioMap',
            artwork: s.station.favicon ? [{ src: s.station.favicon, sizes: '256x256' }] : [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          });
        }
      }
      if (s.status !== prev.status) {
        ms.playbackState = s.status === 'playing' || s.status === 'loading' ? 'playing' : s.station ? 'paused' : 'none';
      }
    });
  }
}
