import list from '@/data/genres.json';
import type { Lang } from './i18n';

export interface Genre {
  id: string;
  en: string;
  ru: string;
  color: string;
  bit: number;
}

export const GENRES: Genre[] = list.map((g, bit) => ({ ...g, bit }));

export function genreLabel(g: Genre, lang: Lang) {
  return lang === 'ru' ? g.ru : g.en;
}

/** Genres present in a station's bit mask, in display order. */
export function genresOf(mask: number): Genre[] {
  if (!mask) return [];
  return GENRES.filter((g) => mask & (1 << g.bit));
}

export function hasGenre(mask: number, bit: number) {
  return bit < 0 || (mask & (1 << bit)) !== 0;
}

/** The most specific genre of a station: "Jazz" beats "Pop" when a station is tagged with both. */
export function primaryGenre(mask: number, counts: ArrayLike<number> | undefined): Genre | null {
  if (!mask) return null;
  let best: Genre | null = null;
  for (const g of GENRES) {
    if (!(mask & (1 << g.bit))) continue;
    if (!best || (counts && counts[g.bit] < counts[best.bit])) best = g;
  }
  return best;
}
