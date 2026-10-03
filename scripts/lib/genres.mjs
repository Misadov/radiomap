// Maps free-form radio-browser tags onto the fixed genre list in src/data/genres.json.
// Tags are compared after key() normalisation ("Hip-Hop" -> "hip hop", "R&B" -> "r b").
//   words: matches when the phrase appears as whole words anywhere in the tag
//   exact: matches only when the whole tag equals the phrase

import { readFileSync } from 'node:fs';
import { key } from './text.mjs';

const GENRES = JSON.parse(
  readFileSync(new URL('../../src/data/genres.json', import.meta.url), 'utf8'),
);

const RULES = {
  pop: {
    words: ['pop', 'top 40', 'top40', 'top 100', 'adult contemporary', 'hot ac', 'hit radio', 'hitradio', 'europop', 'kpop', 'k pop', 'jpop', 'j pop', 'cpop', 'c pop', 'cantopop', 'mandopop', 'synthpop', 'synth pop', 'schlager', 'estrada', 'эстрада', 'поп', 'opm', 'mainstream'],
    exact: ['hits', 'hit', 'top hits', 'charts', 'chart', 'chr', 'ac', 'contemporary', 'variety', 'current hits', 'new hits'],
  },
  rock: {
    words: ['rock', 'rock n roll', 'rocknroll', 'grunge', 'punk', 'рок', 'aor', 'rockabilly', 'rock and roll'],
    exact: ['progressive', 'prog'],
  },
  electronic: {
    words: ['electronic', 'electronica', 'electro', 'techno', 'house', 'trance', 'edm', 'dubstep', 'drum and bass', 'drum n bass', 'drum bass', 'dnb', 'd b', 'breakbeat', 'breaks', 'hardstyle', 'psytrance', 'psy', 'goa', 'idm', 'synthwave', 'minimal', 'jungle', 'uk garage', 'future bass', 'bass music', 'электронная', 'электроника', 'electronique', 'elektronik', 'trip hop', 'big beat', 'vaporwave', 'hard dance', 'gabber', 'chillstep', 'eurodance'],
  },
  dance: {
    words: ['dance', 'disco', 'eurodance', 'hi nrg', 'italo disco', 'club', 'clubbing', 'party', 'dancefloor', 'танцевальная', 'nu disco', 'baile'],
  },
  hiphop: {
    words: ['hip hop', 'hiphop', 'rap', 'trap', 'grime', 'drill', 'urban', 'хип хоп', 'рэп'],
  },
  jazz: {
    words: ['jazz', 'swing', 'bebop', 'big band', 'bossa nova', 'bossanova', 'джаз', 'dixieland'],
  },
  classical: {
    words: ['classical', 'classique', 'klassik', 'clasica', 'classica', 'opera', 'baroque', 'symphony', 'symphonic', 'orchestra', 'orchestral', 'chamber music', 'early music', 'классика', 'классическая', 'klasik', 'klassisk', 'klasyczna', 'piano'],
    exact: ['classic', 'classics', 'klassiek'],
  },
  chill: {
    words: ['chillout', 'chill out', 'chill', 'lounge', 'ambient', 'downtempo', 'relax', 'relaxing', 'relaxation', 'easy listening', 'meditation', 'spa', 'sleep', 'lofi', 'lo fi', 'new age', 'calm', 'chillhop', 'beautiful music', 'smooth', 'background music', 'study'],
  },
  news: {
    words: ['news', 'noticias', 'noticia', 'nachrichten', 'informacion', 'information', 'informativo', 'info', 'actualites', 'actualite', 'notizie', 'новости', 'current affairs', 'newstalk', 'journalism', 'weather', 'nieuws', 'wiadomosci', 'haber', 'haberler', 'jornalismo', 'noticiero'],
  },
  talk: {
    words: ['talk', 'talk radio', 'public radio', 'culture', 'cultura', 'kultur', 'culturel', 'culturale', 'comedy', 'humor', 'humour', 'podcast', 'podcasts', 'interviews', 'spoken word', 'educational', 'education', 'university', 'universidad', 'universitaria', 'community', 'community radio', 'politics', 'politica', 'debate', 'audiobook', 'audiobooks', 'audio drama', 'storytelling', 'drama', 'literature', 'poetry', 'science', 'history', 'documentary', 'horspiel', 'разговорное', 'talkshow', 'talk show', 'entertainment', 'lifestyle', 'magazine'],
  },
  oldies: {
    words: ['oldies', 'oldie', 'retro', 'classic hits', 'golden oldies', 'nostalgia', 'nostalgie', 'evergreen', 'evergreens', '50s', '60s', '70s', '80s', '90s', '1950s', '1960s', '1970s', '1980s', '1990s', 'decades', 'ретро', 'oldschool', 'old school', 'old hits', 'throwback', 'vintage', 'clasicos', 'classicos', 'anos 60', 'anos 70', 'anos 80', 'anos 90', 'anni 60', 'anni 70', 'anni 80', 'anni 90', 'annees 80'],
    exact: ['golden', '00s', '2000s'],
  },
  latin: {
    words: ['latin', 'latino', 'latina', 'latinos', 'salsa', 'reggaeton', 'bachata', 'cumbia', 'merengue', 'tropical', 'regional mexicano', 'regional mexican', 'banda', 'ranchera', 'rancheras', 'norteno', 'nortena', 'mariachi', 'tango', 'samba', 'mpb', 'sertanejo', 'forro', 'pagode', 'vallenato', 'grupera', 'musica latina', 'axe', 'tejano', 'bolero', 'boleros', 'cuarteto', 'chamame', 'urbano', 'musica mexicana', 'corridos', 'duranguense'],
  },
  country: {
    words: ['country', 'americana', 'bluegrass', 'western', 'honky tonk', 'nashville', 'red dirt'],
  },
  rnb: {
    words: ['rnb', 'r b', 'r n b', 'rhythm and blues', 'soul', 'funk', 'funky', 'motown', 'neo soul', 'quiet storm'],
  },
  metal: {
    words: ['metal', 'thrash', 'metalcore', 'deathcore', 'doom', 'heavy'],
  },
  alternative: {
    words: ['alternative', 'alternativa', 'alternativo', 'indie', 'alt rock', 'post punk', 'new wave', 'shoegaze', 'britpop', 'emo', 'college radio', 'garage rock'],
  },
  reggae: {
    words: ['reggae', 'dancehall', 'ska', 'dub', 'lovers rock', 'soca', 'calypso', 'zouk', 'kompa', 'rocksteady', 'caribbean'],
  },
  world: {
    words: ['world', 'world music', 'ethnic', 'afrobeat', 'afrobeats', 'afropop', 'african music', 'bollywood', 'celtic', 'balkan', 'oriental', 'laiko', 'rebetiko', 'highlife', 'bongo flava', 'amapiano', 'kizomba', 'fado', 'flamenco', 'musique du monde', 'bhangra', 'carnatic', 'ghazal', 'qawwali', 'mizrahi', 'klezmer', 'gypsy', 'manele', 'turbo folk', 'arabesk', 'tarab', 'mbalax', 'soukous', 'zouglou', 'coupe decale', 'gnawa', 'hawaiian', 'enka', 'dangdut'],
  },
  folk: {
    words: ['folk', 'folklore', 'folklorica', 'folclore', 'traditional', 'acoustic', 'singer songwriter', 'volksmusik', 'volkstumliche', 'volkstumlich', 'polka', 'blasmusik', 'народная', 'шансон', 'chanson', 'авторская песня', 'irish folk'],
  },
  blues: {
    words: ['blues', 'блюз'],
  },
  religious: {
    words: ['christian', 'christianity', 'gospel', 'religious', 'religion', 'religiosa', 'religioso', 'worship', 'praise', 'catholic', 'catolica', 'catolico', 'catholique', 'cattolica', 'katholisch', 'church', 'iglesia', 'igreja', 'evangelical', 'evangelica', 'evangelico', 'evangelisch', 'evangelique', 'bible', 'biblical', 'biblia', 'islam', 'islamic', 'islamique', 'quran', 'koran', 'coran', 'muslim', 'spiritual', 'spirituality', 'sermon', 'sermons', 'devotional', 'hindu', 'bhajan', 'bhakti', 'kirtan', 'buddhist', 'buddhism', 'orthodox', 'православное', 'православие', 'jewish', 'torah', 'christliche', 'christlich', 'cristiana', 'cristiano', 'cristao', 'crista', 'adventist', 'pentecostal', 'ccm', 'hymns', 'hymn', 'chretien', 'chretienne', 'messianic', 'faith', 'jesus', 'sufi', 'nasheed'],
  },
  sports: {
    words: ['sport', 'sports', 'football', 'soccer', 'futbol', 'futebol', 'fussball', 'deportes', 'deportiva', 'deportivo', 'esportes', 'baseball', 'basketball', 'hockey', 'cricket', 'nfl', 'nba', 'mlb', 'nhl', 'racing', 'f1', 'formula 1', 'спорт', 'calcio', 'rugby', 'tennis', 'golf'],
  },
  kids: {
    words: ['kids', 'kid', 'children', 'childrens', 'children s', 'kinder', 'kindermusik', 'infantil', 'infantiles', 'детское', 'детские', 'enfants', 'enfant', 'bambini', 'nursery', 'lullaby', 'lullabies', 'disney'],
  },
  soundtrack: {
    words: ['soundtrack', 'soundtracks', 'film', 'films', 'movie', 'movies', 'film music', 'filmmusik', 'score', 'scores', 'game music', 'video game', 'video games', 'videogame', 'gaming', 'anime', 'musical', 'musicals', 'broadway', 'showtunes', 'show tunes', 'cinema', 'kino', 'epic'],
  },
};

const compiled = GENRES.map((genre, bit) => {
  const rule = RULES[genre.id];
  if (!rule) throw new Error(`No tag rules for genre "${genre.id}"`);
  return {
    bit,
    words: (rule.words ?? []).map((w) => ` ${key(w)} `),
    exact: new Set((rule.exact ?? []).map(key)),
  };
});

const cache = new Map();

/** Bit mask of genres for a single normalised tag. */
function tagMask(tag) {
  let mask = cache.get(tag);
  if (mask !== undefined) return mask;
  mask = 0;
  const padded = ` ${tag} `;
  for (const g of compiled) {
    if (g.exact.has(tag) || g.words.some((w) => padded.includes(w))) mask |= 1 << g.bit;
  }
  cache.set(tag, mask);
  return mask;
}

/** Bit mask of genres for a list of normalised tags. */
export function genreMask(tags) {
  let mask = 0;
  for (const tag of tags) mask |= tagMask(tag);
  return mask >>> 0;
}

export const GENRE_COUNT = GENRES.length;
