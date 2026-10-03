// Gamification: a radio "passport" — stamps for every country and city you tune into,
// XP, levels and achievements. Everything lives in the browser (library store).

export interface PassportStats {
  xp: number;
  plays: number;
  countries: Record<string, number>; // cc -> first visit timestamp
  places: Record<string, number>; // "CC|Place name" -> first visit timestamp
  genres: Record<string, number>; // genre id -> first time
  achievements: Record<string, number>; // id -> unlocked at
  lastLat: number | null;
  lastLng: number | null;
  bestJumpKm: number;
  /** Play counts, for the "most listened" stats. */
  countryPlays: Record<string, number>;
  genrePlays: Record<string, number>;
  placePlays: Record<string, number>;
  stationPlays: Record<string, { n: number; name: string }>;
  /** Seconds actually listened. */
  listenSec: number;
  /** Days (YYYY-MM-DD) with at least one play, for streaks. */
  days: string[];
}

export const EMPTY_PASSPORT: PassportStats = {
  xp: 0,
  plays: 0,
  countries: {},
  places: {},
  genres: {},
  achievements: {},
  lastLat: null,
  lastLng: null,
  bestJumpKm: 0,
  countryPlays: {},
  genrePlays: {},
  placePlays: {},
  stationPlays: {},
  listenSec: 0,
  days: [],
};

/** Highest-count key of a tally. */
export function topOf<T>(tally: Record<string, T>, count: (v: T) => number): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [k, v] of Object.entries(tally)) {
    const n = count(v);
    if (!best || n > best[1]) best = [k, n];
  }
  return best;
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Longest and current runs of consecutive listening days. */
export function streaks(days: string[]): { best: number; current: number } {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00`);
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  let current = 0;
  const cursor = new Date();
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { best, current };
}

export const XP = { play: 10, place: 25, country: 60, genre: 15, achievement: 100 };

export interface Achievement {
  id: string;
  icon: string;
  en: [string, string];
  ru: [string, string];
  test: (s: PassportStats) => boolean;
}

const n = (o: Record<string, number>) => Object.keys(o).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '📻', en: ['First tune', 'Play your first station'], ru: ['Первый эфир', 'Включите первую станцию'], test: (s) => s.plays >= 1 },
  { id: 'c5', icon: '🧳', en: ['Tourist', 'Listen to 5 countries'], ru: ['Турист', 'Послушайте 5 стран'], test: (s) => n(s.countries) >= 5 },
  { id: 'c15', icon: '✈️', en: ['Traveller', 'Listen to 15 countries'], ru: ['Путешественник', 'Послушайте 15 стран'], test: (s) => n(s.countries) >= 15 },
  { id: 'c40', icon: '🌍', en: ['Globetrotter', 'Listen to 40 countries'], ru: ['Глобтроттер', 'Послушайте 40 стран'], test: (s) => n(s.countries) >= 40 },
  { id: 'c100', icon: '🛰️', en: ['Satellite', 'Listen to 100 countries'], ru: ['Спутник', 'Послушайте 100 стран'], test: (s) => n(s.countries) >= 100 },
  { id: 'p10', icon: '🏙️', en: ['City hopper', 'Tune into 10 cities'], ru: ['Городской житель', 'Настройтесь на 10 городов'], test: (s) => n(s.places) >= 10 },
  { id: 'p50', icon: '🗺️', en: ['Cartographer', 'Tune into 50 cities'], ru: ['Картограф', 'Настройтесь на 50 городов'], test: (s) => n(s.places) >= 50 },
  { id: 'g6', icon: '🎛️', en: ['Eclectic', 'Hear 6 different genres'], ru: ['Меломан', 'Послушайте 6 разных жанров'], test: (s) => n(s.genres) >= 6 },
  { id: 'g15', icon: '🎶', en: ['Music nerd', 'Hear 15 different genres'], ru: ['Знаток', 'Послушайте 15 разных жанров'], test: (s) => n(s.genres) >= 15 },
  { id: 'jump', icon: '🚀', en: ['Teleport', 'Jump over 10,000 km between stations'], ru: ['Телепорт', 'Перенеситесь больше чем на 10 000 км'], test: (s) => s.bestJumpKm >= 10_000 },
  { id: 'plays50', icon: '🔥', en: ['Radio addict', 'Play 50 stations'], ru: ['Радиоман', 'Включите 50 станций'], test: (s) => s.plays >= 50 },
  {
    id: 'night',
    icon: '🦉',
    en: ['Night owl', 'Listen between midnight and 5 am'],
    ru: ['Сова', 'Слушайте радио с полуночи до пяти утра'],
    test: () => new Date().getHours() < 5,
  },
];

export function levelOf(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const from = 40 * (level - 1) ** 2;
  const to = 40 * level ** 2;
  return { level, progress: (xp - from) / (to - from), toNext: to - xp };
}

export const LEVEL_TITLES = {
  en: ['Listener', 'Explorer', 'Navigator', 'DJ', 'Voyager', 'Broadcaster', 'Legend'],
  ru: ['Слушатель', 'Исследователь', 'Штурман', 'Диджей', 'Странник', 'Вещатель', 'Легенда'],
};

export function levelTitle(level: number, lang: 'en' | 'ru') {
  const list = LEVEL_TITLES[lang];
  return list[Math.min(list.length - 1, Math.floor((level - 1) / 3))];
}
