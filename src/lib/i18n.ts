import { useLibrary } from '@/store/library';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];

type Forms = { one: string; few?: string; many?: string; other: string };

const pluralRules: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules('en'),
  ru: new Intl.PluralRules('ru'),
};

const numberFormats: Record<Lang, Intl.NumberFormat> = {
  en: new Intl.NumberFormat('en'),
  ru: new Intl.NumberFormat('ru'),
};

export function formatNumber(n: number, lang: Lang) {
  return numberFormats[lang].format(n);
}

export function plural(n: number, lang: Lang, forms: Forms) {
  const rule = pluralRules[lang].select(n) as keyof Forms;
  const word = forms[rule] ?? forms.other;
  return `${formatNumber(n, lang)} ${word}`;
}

const en = {
  brand: 'RadioMap',
  tagline: 'Live radio from every corner of the planet',
  loading: 'Tuning in…',
  loadError: 'Couldn’t load the stations. Check your connection and try again.',
  retry: 'Retry',

  searchPlaceholder: 'Search stations, cities, genres',
  clear: 'Clear',
  sectionPlaces: 'Places',
  sectionCountries: 'Countries',
  sectionGenres: 'Genres',
  sectionStations: 'Stations',
  noResults: (q: string) => `Nothing found for “${q}”`,
  noResultsHint: 'Try a city, a country or a genre like “jazz”.',

  tabExplore: 'Explore',
  tabFavorites: 'Favorites',
  tabHistory: 'History',

  popularHere: 'Popular in view',
  popularWorld: 'Popular worldwide',
  allGenres: 'All',
  stations: (n: number) => plural(n, 'en', { one: 'station', other: 'stations' }),
  places: (n: number) => plural(n, 'en', { one: 'place', other: 'places' }),
  countriesCount: (n: number) => plural(n, 'en', { one: 'country', other: 'countries' }),
  heroStats: (stations: number, countries: number) =>
    `${plural(stations, 'en', { one: 'live station', other: 'live stations' })} · ${plural(countries, 'en', { one: 'country', other: 'countries' })}`,
  browseCountries: 'Browse countries',
  showAll: 'Show all',
  showLess: 'Show less',

  back: 'Back',
  region: 'Region',
  nearby: 'Nearby',
  inThisPlace: 'Stations here',
  acrossRegion: (region: string) => `Across ${region}`,
  allInCountry: (country: string) => `All of ${country}`,
  nationwide: 'Nationwide & other',
  noStationsForFilter: 'No stations match this genre here.',

  favoritesEmptyTitle: 'No favorites yet',
  favoritesEmptyText: 'Tap the heart on any station to keep it here. Favorites live in this browser.',
  historyEmptyTitle: 'Nothing played yet',
  historyEmptyText: 'Stations you listen to will show up here.',
  exportFavorites: 'Export',
  importFavorites: 'Import',
  imported: (n: number) => (n ? `Added ${plural(n, 'en', { one: 'station', other: 'stations' })}` : 'Everything was already here'),
  importFailed: 'Couldn’t read that file',
  clearHistory: 'Clear',

  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  next: 'Next station',
  previous: 'Previous station',
  volume: 'Volume',
  mute: 'Mute',
  unmute: 'Unmute',
  addFavorite: 'Add to favorites',
  removeFavorite: 'Remove from favorites',
  addedFavorite: 'Added to favorites',
  removedFavorite: 'Removed from favorites',
  share: 'Share',
  linkCopied: 'Link copied',
  website: 'Website',
  live: 'Live',
  connecting: 'Connecting…',
  buffering: 'Buffering…',
  paused: 'Paused',
  errorUnavailable: 'This stream is offline right now.',
  errorInsecure: 'This station only streams over plain HTTP, which browsers block on secure sites.',
  errorUnsupported: 'Your browser can’t play this stream format.',
  tryNext: 'Try next',
  openStream: 'Open stream',
  nowPlaying: 'Now playing',
  onAir: 'On air',
  findTrack: 'Find this track',
  similar: 'You might also like',
  details: 'Details',
  kbps: 'kbps',
  language: 'Language',
  close: 'Close',
  openPlayer: 'Open player',
  readyToPlay: 'Ready to play',
  sharedWithYou: 'Someone shared a station with you',

  hint: 'Click a glowing city to tune in',
  hintTouch: 'Tap a glowing city to tune in',
  random: 'Surprise me',
  randomHint: 'Random station',
  locate: 'Near me',
  locateHint: 'Stations near me',
  locateFailed: 'Couldn’t get your location',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetView: 'Whole globe',
  showOnMap: 'Show on map',
  about: 'About',
  shortcuts: 'Keyboard shortcuts',

  aboutTitle: 'About RadioMap',
  aboutText:
    'RadioMap puts the world’s internet radio on a globe. Spin it, click a glowing city and listen to what’s on air there right now.',
  aboutData:
    'Stations come from the community-run radio-browser.info directory. Locations are resolved with GeoNames; stations without a known city are grouped by region or country. Map data © OpenStreetMap contributors, tiles by OpenFreeMap.',
  dataUpdated: (date: string) => `Station data updated ${date}`,
  sourceCode: 'Source code',
  kbPlayPause: 'Play / pause',
  kbSearch: 'Search',
  kbRandom: 'Random station',
  kbFavorite: 'Favorite current station',
  kbMute: 'Mute',
  kbVolume: 'Volume',
  kbNextPrev: 'Next / previous station',
  kbClose: 'Close panel',
  kbHelp: 'Show shortcuts',
};

export type Dict = typeof en;

const ru: Dict = {
  brand: 'RadioMap',
  tagline: 'Живое радио со всех уголков планеты',
  loading: 'Настраиваемся…',
  loadError: 'Не удалось загрузить станции. Проверьте соединение и попробуйте ещё раз.',
  retry: 'Повторить',

  searchPlaceholder: 'Станции, города, жанры',
  clear: 'Очистить',
  sectionPlaces: 'Места',
  sectionCountries: 'Страны',
  sectionGenres: 'Жанры',
  sectionStations: 'Станции',
  noResults: (q: string) => `По запросу «${q}» ничего не нашлось`,
  noResultsHint: 'Попробуйте город, страну или жанр — например, «джаз».',

  tabExplore: 'Обзор',
  tabFavorites: 'Избранное',
  tabHistory: 'История',

  popularHere: 'Популярное на карте',
  popularWorld: 'Популярное в мире',
  allGenres: 'Все',
  stations: (n: number) => plural(n, 'ru', { one: 'станция', few: 'станции', many: 'станций', other: 'станции' }),
  places: (n: number) => plural(n, 'ru', { one: 'место', few: 'места', many: 'мест', other: 'места' }),
  countriesCount: (n: number) => plural(n, 'ru', { one: 'страна', few: 'страны', many: 'стран', other: 'страны' }),
  heroStats: (stations: number, countries: number) =>
    `${plural(stations, 'ru', { one: 'станция', few: 'станции', many: 'станций', other: 'станции' })} в эфире · ${plural(countries, 'ru', { one: 'страна', few: 'страны', many: 'стран', other: 'страны' })}`,
  browseCountries: 'Все страны',
  showAll: 'Показать все',
  showLess: 'Свернуть',

  back: 'Назад',
  region: 'Регион',
  nearby: 'Рядом',
  inThisPlace: 'Станции здесь',
  acrossRegion: (region: string) => `По региону: ${region}`,
  allInCountry: (country: string) => `Вся страна: ${country}`,
  nationwide: 'Общенациональные и другие',
  noStationsForFilter: 'Здесь нет станций этого жанра.',

  favoritesEmptyTitle: 'В избранном пусто',
  favoritesEmptyText: 'Нажмите на сердечко у любой станции, чтобы сохранить её. Избранное хранится в этом браузере.',
  historyEmptyTitle: 'Вы ещё ничего не слушали',
  historyEmptyText: 'Здесь появятся станции, которые вы включали.',
  exportFavorites: 'Экспорт',
  importFavorites: 'Импорт',
  imported: (n: number) =>
    n ? `Добавлено: ${plural(n, 'ru', { one: 'станция', few: 'станции', many: 'станций', other: 'станции' })}` : 'Всё уже было в избранном',
  importFailed: 'Не удалось прочитать файл',
  clearHistory: 'Очистить',

  play: 'Слушать',
  pause: 'Пауза',
  stop: 'Стоп',
  next: 'Следующая станция',
  previous: 'Предыдущая станция',
  volume: 'Громкость',
  mute: 'Выключить звук',
  unmute: 'Включить звук',
  addFavorite: 'В избранное',
  removeFavorite: 'Убрать из избранного',
  addedFavorite: 'Добавлено в избранное',
  removedFavorite: 'Убрано из избранного',
  share: 'Поделиться',
  linkCopied: 'Ссылка скопирована',
  website: 'Сайт',
  live: 'Эфир',
  connecting: 'Подключение…',
  buffering: 'Буферизация…',
  paused: 'Пауза',
  errorUnavailable: 'Поток сейчас недоступен.',
  errorInsecure: 'Станция вещает только по незащищённому HTTP — браузеры блокируют такие потоки на защищённых сайтах.',
  errorUnsupported: 'Браузер не умеет воспроизводить этот формат.',
  tryNext: 'Следующая',
  openStream: 'Открыть поток',
  nowPlaying: 'Сейчас играет',
  onAir: 'В эфире',
  findTrack: 'Найти трек',
  similar: 'Вам может понравиться',
  details: 'Подробнее',
  kbps: 'кбит/с',
  language: 'Язык',
  close: 'Закрыть',
  openPlayer: 'Открыть плеер',
  readyToPlay: 'Готово к воспроизведению',
  sharedWithYou: 'С вами поделились станцией',

  hint: 'Нажмите на светящийся город, чтобы настроиться',
  hintTouch: 'Коснитесь светящегося города, чтобы настроиться',
  random: 'Мне повезёт',
  randomHint: 'Случайная станция',
  locate: 'Рядом',
  locateHint: 'Станции рядом со мной',
  locateFailed: 'Не удалось определить местоположение',
  zoomIn: 'Приблизить',
  zoomOut: 'Отдалить',
  resetView: 'Весь глобус',
  showOnMap: 'Показать на карте',
  about: 'О проекте',
  shortcuts: 'Горячие клавиши',

  aboutTitle: 'О RadioMap',
  aboutText:
    'RadioMap раскладывает интернет-радио всего мира по глобусу. Покрутите его, нажмите на светящийся город и слушайте, что там сейчас в эфире.',
  aboutData:
    'Станции — из открытого каталога radio-browser.info. Местоположение определяется по базе GeoNames; станции без известного города сгруппированы по регионам и странам. Картография © участники OpenStreetMap, тайлы OpenFreeMap.',
  dataUpdated: (date: string) => `Данные обновлены ${date}`,
  sourceCode: 'Исходный код',
  kbPlayPause: 'Пауза / воспроизведение',
  kbSearch: 'Поиск',
  kbRandom: 'Случайная станция',
  kbFavorite: 'Текущую — в избранное',
  kbMute: 'Без звука',
  kbVolume: 'Громкость',
  kbNextPrev: 'Следующая / предыдущая',
  kbClose: 'Закрыть панель',
  kbHelp: 'Показать подсказку',
};

export const dictionaries: Record<Lang, Dict> = { en, ru };

export function useLang(): Lang {
  return useLibrary((s) => s.lang);
}

export function useT(): Dict {
  return dictionaries[useLibrary((s) => s.lang)];
}

const regionNames = new Map<Lang, Intl.DisplayNames>();

/** Localised country name for an ISO 3166-1 alpha-2 code. */
export function countryName(cc: string, lang: Lang): string {
  if (!cc) return '';
  let dn = regionNames.get(lang);
  if (!dn) {
    dn = new Intl.DisplayNames([lang], { type: 'region' });
    regionNames.set(lang, dn);
  }
  try {
    return dn.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

const languageNames = new Map<Lang, Intl.DisplayNames>();
const LANGUAGE_CODES: Record<string, string> = {
  english: 'en', german: 'de', french: 'fr', spanish: 'es', russian: 'ru', italian: 'it', portuguese: 'pt',
  dutch: 'nl', polish: 'pl', greek: 'el', turkish: 'tr', arabic: 'ar', chinese: 'zh', japanese: 'ja',
  korean: 'ko', ukrainian: 'uk', romanian: 'ro', czech: 'cs', hungarian: 'hu', swedish: 'sv', norwegian: 'no',
  danish: 'da', finnish: 'fi', hebrew: 'he', hindi: 'hi', indonesian: 'id', persian: 'fa', serbian: 'sr',
  croatian: 'hr', bulgarian: 'bg', slovak: 'sk', slovenian: 'sl', thai: 'th', vietnamese: 'vi', catalan: 'ca',
  tagalog: 'tl', filipino: 'fil', malay: 'ms', bengali: 'bn', tamil: 'ta', urdu: 'ur', swahili: 'sw',
  lithuanian: 'lt', latvian: 'lv', estonian: 'et', albanian: 'sq', macedonian: 'mk', bosnian: 'bs',
  belarusian: 'be', kazakh: 'kk', georgian: 'ka', armenian: 'hy', azerbaijani: 'az', icelandic: 'is',
  irish: 'ga', welsh: 'cy', basque: 'eu', galician: 'gl', afrikaans: 'af', amharic: 'am', somali: 'so',
  punjabi: 'pa', telugu: 'te', marathi: 'mr', gujarati: 'gu', kannada: 'kn', malayalam: 'ml', nepali: 'ne',
  sinhala: 'si', khmer: 'km', lao: 'lo', burmese: 'my', mongolian: 'mn', uzbek: 'uz', pashto: 'ps',
  kurdish: 'ku', hausa: 'ha', yoruba: 'yo', igbo: 'ig', zulu: 'zu', maltese: 'mt', luxembourgish: 'lb',
};

/** Pretty, localised language name from radio-browser's free-text language field. */
export function languageName(raw: string, lang: Lang): string {
  if (!raw) return '';
  const code = LANGUAGE_CODES[raw.toLowerCase()];
  if (code) {
    let dn = languageNames.get(lang);
    if (!dn) {
      dn = new Intl.DisplayNames([lang], { type: 'language' });
      languageNames.set(lang, dn);
    }
    try {
      const name = dn.of(code);
      if (name) return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
    } catch {
      /* fall through */
    }
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
