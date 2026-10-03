'use client';

import { create } from 'zustand';

export type Selection = { kind: 'place'; place: number } | { kind: 'country'; cc: string } | null;
export type Tab = 'explore' | 'favorites' | 'history';
export type SheetSnap = 'peek' | 'half' | 'full';

export interface Toast {
  id: number;
  text: string;
  tone?: 'default' | 'error';
}

interface UIState {
  selection: Selection;
  /** Previous selections, for the panel's back button. */
  trail: Selection[];
  tab: Tab;
  query: string;
  /** Genre filter (bit index into genres.json), -1 for all. */
  genre: number;
  /** Station indices visible in the current map viewport, best first. */
  inView: number[] | null;
  /** True while the globe shows (almost) the whole planet. */
  worldView: boolean;
  nowPlayingOpen: boolean;
  aboutOpen: boolean;
  sheet: SheetSnap;
  toasts: Toast[];

  select: (selection: Selection, opts?: { push?: boolean }) => void;
  back: () => void;
  setTab: (tab: Tab) => void;
  setQuery: (query: string) => void;
  setGenre: (genre: number) => void;
  setInView: (inView: number[], worldView: boolean) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setSheet: (sheet: SheetSnap) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

const same = (a: Selection, b: Selection) =>
  a === b ||
  (!!a && !!b && a.kind === b.kind && (a.kind === 'place' ? a.place === (b as typeof a).place : a.cc === (b as { cc: string }).cc));

export const useUI = create<UIState>()((set, get) => ({
  selection: null,
  trail: [],
  tab: 'explore',
  query: '',
  genre: -1,
  inView: null,
  worldView: true,
  nowPlayingOpen: false,
  aboutOpen: false,
  sheet: 'peek',
  toasts: [],

  select: (selection, opts) => {
    const { selection: current, trail } = get();
    if (same(current, selection)) return;
    set({
      selection,
      trail: selection && opts?.push && current ? [...trail, current].slice(-12) : selection ? trail : [],
      query: '',
    });
  },
  back: () => {
    const { trail } = get();
    set({ selection: trail.at(-1) ?? null, trail: trail.slice(0, -1) });
  },
  setTab: (tab) => set({ tab, selection: null, trail: [], query: '' }),
  setQuery: (query) => set({ query }),
  setGenre: (genre) => set({ genre }),
  setInView: (inView, worldView) => set({ inView, worldView }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setSheet: (sheet) => set({ sheet }),
  toast: (text, tone = 'default') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
