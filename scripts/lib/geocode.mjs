// Offline geocoder for radio stations, backed by GeoNames.
//
// Most stations in radio-browser have no coordinates, only a country and a free-text
// "state" field (which in practice holds anything from "Bayern" to "Sydney NSW").
// We resolve, in order of confidence:
//   1. station coordinates  -> snapped to the city they belong to
//   2. the "state" field    -> a city or a first-level region of that country
//   3. the station name     -> a well-known city mentioned in it ("Radio Kyiv")
// Anything else stays country-level and is reachable through browse & search.

import { haversineKm, key } from './text.mjs';

export const PRECISION = { NONE: 0, COUNTRY: 1, REGION: 2, CITY_FROM_NAME: 3, CITY_FROM_STATE: 4, COORDINATES: 5 };

const CELL = 1; // degrees per spatial grid cell

// Words that frequently surround a location in the "state" field.
const GENERIC = new Set(
  [
    'region', 'regione', 'regiao', 'oblast', 'obl', 'province', 'provincia', 'provincie', 'provinz',
    'state', 'estado', 'departamento', 'department', 'departement', 'district', 'distrito', 'county',
    'prefecture', 'governorate', 'municipality', 'municipio', 'city', 'ciudad', 'cidade', 'metropolitan',
    'metro', 'area', 'krai', 'kray', 'kraj', 'voivodeship', 'wojewodztwo', 'land', 'bundesland', 'canton',
    'kanton', 'comunidad', 'communaute', 'autonomous', 'republic', 'republica', 'greater', 'grand',
    'респ', 'республика', 'область', 'обл', 'край', 'город', 'г', 'of', 'de', 'del', 'do', 'da', 'the',
  ].map(key),
);

// Tokens that look like places but are far more often just words in a station name.
const NAME_STOPWORDS = new Set(
  [
    'radio', 'music', 'musica', 'love', 'star', 'stars', 'mega', 'power', 'classic', 'hits', 'nova', 'sol',
    'luz', 'vida', 'paz', 'esperanza', 'victoria', 'gloria', 'santa', 'santo', 'maria', 'cristo', 'jesus',
    'union', 'libertad', 'progreso', 'providence', 'hope', 'grace', 'harmony', 'liberty', 'eden', 'zion',
    'bethel', 'phoenix', 'mix', 'max', 'energy', 'kiss', 'magic', 'smooth', 'heart', 'capital', 'central',
    'national', 'international', 'world', 'global', 'live', 'online', 'stereo', 'digital', 'jazz', 'rock',
    'country', 'gold', 'golden', 'oldies', 'news', 'sport', 'sports', 'family', 'christian', 'gospel',
    'nostalgie', 'europa', 'europe', 'africa', 'america', 'asia', 'orient', 'oriental', 'latina', 'latino',
    'top', 'best', 'happy', 'sunshine', 'paradise', 'ocean', 'island', 'valley', 'mountain', 'river',
    'lake', 'beach', 'bay', 'coast', 'north', 'south', 'east', 'west', 'nord', 'sud', 'est', 'ouest',
    'norte', 'sur', 'oeste', 'centro', 'center', 'centre', 'city', 'metro', 'urban', 'regional', 'local',
    'universal', 'cosmos', 'planet', 'galaxy', 'orbit', 'zeta', 'alpha', 'omega', 'delta', 'sigma',
    'aurora', 'florida', 'carolina', 'georgia', 'virginia', 'victoria', 'alexandria', 'columbia',
    'lincoln', 'washington', 'jackson', 'franklin', 'clinton', 'madison', 'monroe', 'jefferson',
    'hamilton', 'kingston', 'georgetown', 'salem', 'richmond', 'arlington', 'springfield', 'hollywood',
    'motown', 'vegas',
    'reading', 'bath', 'nice', 'split', 'mobile', 'mesa', 'gary', 'tyler', 'sandy', 'eugene', 'chester',
    'derby', 'mansfield', 'stockport', 'bolton', 'preston', 'buffalo', 'dayton', 'marion', 'warren',
    'irving', 'ontario', 'laval', 'leon', 'cordoba', 'granada', 'merida', 'santiago', 'trinidad',
    'concepcion', 'esperance', 'bonne', 'belle', 'mira', 'vista', 'bella', 'linda', 'rica', 'dorado',
  ].map(key),
);

// Region names that are also everyday words ("Central", "Coast", "Mexico" in "Radio Mexico").
const REGION_STOPWORDS = new Set(
  [
    'mexico', 'panama', 'georgia', 'distrito', 'federal', 'capital', 'national', 'centre', 'central',
    'western', 'eastern', 'northern', 'southern', 'upper', 'lower', 'coast', 'islands', 'island', 'lakes',
    'highlands', 'mountains', 'plateau', 'littoral', 'maritime', 'oriental', 'occidental', 'santa',
    'amazonas', 'la paz', 'lima', 'buenos aires', 'sao paulo', 'rio de janeiro', 'new york', 'washington',
    'victoria', 'vienna', 'berlin', 'hamburg', 'bremen', 'madrid', 'moscow', 'london', 'paris', 'tokyo',
  ].map(key),
);

// Han / kana / hangul names carry no spaces, so they are matched as substrings.
const CJK = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u;
const CJK_ANY = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CJK_SUFFIX = /[市县縣区區镇鎮郡町村]$/u;
const CJK_STOPWORDS = new Set([
  '中国', '中華', '中华', '东方', '東方', '中山', '华夏', '華夏', '江南', '天天', '新华', '城市', '交通', '音乐', '音樂',
  '经济', '經濟', '新闻', '新聞', '都市', '文艺', '生活', '故事', '旅游', '长江', '黄河', '南方', '北方', '西部', '东部',
  '中央', '国际', '國際', '人民', '和平', '光明', '太阳', '星空', '阳光', '青春', '快乐', '健康', '未来', '希望', '中原',
  '东南', '西南', '西北', '东北', '华北', '华南', '华东', '海峡', '台湾', '台灣', '香港', '澳门', '澳門', '大同', '永安',
  '中心', '城关', '城區', '城区', '开发', '高新', '新区', '新區', '长安', '永和', '太平', '向阳', '红旗', '前进', '解放',
  '胜利', '建设', '民主', '团结', '幸福', '人和', '中和', '平安', '吉祥', '长寿', '万年', '新城', '东城', '西城',
]);

function snapRadiusKm(pop) {
  // 1k -> 6 km, 10k -> 13 km, 100k -> 20 km, 1M -> 27 km, 10M -> 34 km
  return 6 + 7 * Math.log10(Math.max(pop, 1000) / 1000);
}

function pushTo(map, k, value) {
  if (!k) return;
  const list = map.get(k);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map.set(k, [value]);
}

export function createGeocoder({ cities, admin1, countries }) {
  // ---- spatial grid --------------------------------------------------------
  const grid = new Map();
  for (const city of cities) {
    const k = `${Math.floor(city.lat / CELL)}:${Math.floor(city.lng / CELL)}`;
    pushTo(grid, k, city);
  }

  function* citiesNear(lat, lng, rangeCells = 1) {
    const r0 = Math.floor(lat / CELL);
    const c0 = Math.floor(lng / CELL);
    for (let r = r0 - rangeCells; r <= r0 + rangeCells; r++) {
      for (let c = c0 - rangeCells; c <= c0 + rangeCells; c++) {
        const cc = ((c + 180 / CELL) % (360 / CELL) + 360 / CELL) % (360 / CELL) - 180 / CELL;
        const list = grid.get(`${r}:${cc}`);
        if (list) yield* list;
      }
    }
  }

  // ---- region statistics: population and population-weighted centroid ------
  const regionStats = new Map();
  for (const city of cities) {
    const pop = Math.max(city.pop, 1000);
    const s = regionStats.get(city.a1) ?? { pop: 0, x: 0, y: 0, z: 0, biggest: null };
    const rad = Math.PI / 180;
    s.pop += city.pop;
    s.x += pop * Math.cos(city.lat * rad) * Math.cos(city.lng * rad);
    s.y += pop * Math.cos(city.lat * rad) * Math.sin(city.lng * rad);
    s.z += pop * Math.sin(city.lat * rad);
    if (!s.biggest || city.pop > s.biggest.pop) s.biggest = city;
    regionStats.set(city.a1, s);
  }

  const regions = new Map();
  for (const [code, a] of admin1) {
    const s = regionStats.get(code);
    if (!s) continue;
    const deg = 180 / Math.PI;
    let lat = Math.atan2(s.z, Math.hypot(s.x, s.y)) * deg;
    let lng = Math.atan2(s.y, s.x) * deg;
    // A centroid that lands far from every city of the region is probably at sea
    // (archipelagos, crescent-shaped coasts): fall back to the biggest city.
    let nearest = Infinity;
    for (const city of citiesNear(lat, lng, 1)) {
      if (city.a1 === code) nearest = Math.min(nearest, haversineKm(lat, lng, city.lat, city.lng));
    }
    if (nearest > 60) ({ lat, lng } = s.biggest);
    regions.set(code, { ...a, pop: s.pop, lat, lng });
  }

  // ---- name indexes -------------------------------------------------------
  const cityNames = new Map(); // cc -> Map<key, city[]>
  const regionNames = new Map(); // cc -> Map<key, region[]>
  const famousCities = new Map(); // cc -> Map<key, city[]>  (for station-name matching)
  const regionCities = new Map(); // admin1 -> Map<key, city[]> (station name, once the region is known)
  const regionInName = new Map(); // cc -> Map<key, region[]>  (region mentioned in a station name)
  const cjkByCountry = new Map(); // cc -> [name, city][]      (longest names first)
  const cjkByRegion = new Map(); // admin1 -> [name, city][]

  const forCountry = (map, cc) => map.get(cc) ?? map.set(cc, new Map()).get(cc);

  for (const city of cities) {
    const names = forCountry(cityNames, city.cc);
    pushTo(names, key(city.name), city);
    pushTo(names, key(city.ascii), city);
    for (const alt of city.alts) pushTo(names, key(alt), city);

    if (city.pop >= 30_000) {
      const famous = forCountry(famousCities, city.cc);
      const own = [city.name, city.ascii];
      if (city.pop >= 300_000) {
        for (const alt of city.alts) if (/^[\p{Script=Latin}\p{Script=Cyrillic}\s'’.-]+$/u.test(alt)) own.push(alt);
      }
      for (const n of own) {
        const k = key(n);
        if (k.length >= 4 && !NAME_STOPWORDS.has(k)) pushTo(famous, k, city);
      }
    }
    if (city.pop >= 2_000) {
      const local = forCountry(regionCities, city.a1);
      const own = [city.name, city.ascii];
      if (city.pop >= 20_000) {
        for (const alt of city.alts) if (/^[\p{Script=Latin}\s'’.-]+$/u.test(alt)) own.push(alt);
      }
      for (const n of own) {
        const k = key(n);
        if (k.length >= 4 && !NAME_STOPWORDS.has(k)) pushTo(local, k, city);
      }
    }
    if (city.pop >= 5_000) {
      const cjk = new Set();
      for (const alt of [city.name, ...city.alts]) {
        if (!CJK.test(alt)) continue;
        cjk.add(alt);
        if (alt.length >= 3 && CJK_SUFFIX.test(alt)) cjk.add(alt.slice(0, -1));
      }
      for (const n of cjk) {
        if (n.length < 2 || CJK_STOPWORDS.has(n)) continue;
        (cjkByRegion.get(city.a1) ?? cjkByRegion.set(city.a1, []).get(city.a1)).push([n, city]);
        if (city.pop >= 50_000) (cjkByCountry.get(city.cc) ?? cjkByCountry.set(city.cc, []).get(city.cc)).push([n, city]);
      }
    }
  }
  const byLength = (a, b) => b[0].length - a[0].length || b[1].pop - a[1].pop;
  for (const list of cjkByCountry.values()) list.sort(byLength);
  for (const list of cjkByRegion.values()) list.sort(byLength);
  for (const region of regions.values()) {
    const names = forCountry(regionNames, region.cc);
    const inName = forCountry(regionInName, region.cc);
    for (const n of [region.name, region.ascii, region.ru, ...region.alts]) {
      if (!n) continue;
      const k = key(n);
      pushTo(names, k, region);
      if (k.length >= 5 && !NAME_STOPWORDS.has(k) && !REGION_STOPWORDS.has(k)) pushTo(inName, k, region);
    }
  }

  const countryWords = new Map();
  for (const [cc, c] of countries) countryWords.set(cc, key(c.name));

  const biggest = (list) => list.reduce((a, b) => (b.pop > a.pop ? b : a));

  // ---- 1. coordinates ---------------------------------------------------------
  function fromCoordinates(cc, lat, lng) {
    let best = null;
    let bestScore = Infinity;
    let nearestSameCountry = Infinity;
    let nearestAny = null;
    let nearestAnyKm = Infinity;
    for (const city of citiesNear(lat, lng, 1)) {
      const d = haversineKm(lat, lng, city.lat, city.lng);
      if (d < nearestAnyKm) {
        nearestAnyKm = d;
        nearestAny = city;
      }
      if (cc && city.cc !== cc) continue;
      nearestSameCountry = Math.min(nearestSameCountry, d);
      const score = d / snapRadiusKm(city.pop);
      if (score <= 1 && score < bestScore) {
        best = city;
        bestScore = score;
      }
    }
    // Coordinates that sit inside another country, far from any city of the
    // station's own country, are almost always wrong — ignore them.
    if (cc && nearestSameCountry > 150 && nearestAny && nearestAny.cc !== cc && nearestAnyKm < 50) return null;
    if (best) {
      // Boroughs and suburbs fold into the metropolis around them
      // (Manhattan -> New York City, Boulogne-Billancourt -> Paris).
      let metro = best;
      for (const city of citiesNear(lat, lng, 1)) {
        if ((cc && city.cc !== cc) || city.pop < 5 * best.pop || city.pop <= metro.pop) continue;
        if (haversineKm(lat, lng, city.lat, city.lng) <= 0.6 * snapRadiusKm(city.pop)) metro = city;
      }
      return { type: 'city', city: metro, precision: PRECISION.COORDINATES };
    }
    return {
      type: 'point',
      lat,
      lng,
      near: nearestAny && nearestAnyKm < 80 && (!cc || nearestAny.cc === cc) ? nearestAny : null,
      region: nearestAny && regions.get(nearestAny.a1),
      precision: PRECISION.COORDINATES,
    };
  }

  // ---- 2. state field -----------------------------------------------------------
  function stateVariants(raw, cc) {
    const out = [];
    const add = (s) => {
      const k = key(s);
      if (k && !out.includes(k)) out.push(k);
    };
    add(raw);
    const noParens = raw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
    add(noParens);
    const parts = noParens.split(/[,;/|]| - | – | — /);
    for (const p of parts) add(p);

    const country = countryWords.get(cc);
    for (const v of [...out]) {
      let t = v.split(' ');
      // trailing country name ("athens greece")
      if (country && t.length > 1 && t.slice(-country.split(' ').length).join(' ') === country) {
        t = t.slice(0, -country.split(' ').length);
        add(t.join(' '));
      }
      // trailing postal abbreviation ("sydney nsw", "new york ny")
      if (t.length > 1 && t[t.length - 1].length <= 3) add(t.slice(0, -1).join(' '));
      // generic words at either end ("moscow oblast", "state of sao paulo")
      let s = 0;
      let e = t.length;
      while (s < e - 1 && GENERIC.has(t[s])) s++;
      while (e - 1 > s && GENERIC.has(t[e - 1])) e--;
      if (s > 0 || e < t.length) add(t.slice(s, e).join(' '));
    }
    return out;
  }

  const stateCache = new Map();
  function fromState(cc, raw) {
    const cacheKey = `${cc}|${raw}`;
    if (stateCache.has(cacheKey)) return stateCache.get(cacheKey);
    let result = null;
    const cn = cityNames.get(cc);
    const rn = regionNames.get(cc);
    for (const v of stateVariants(raw, cc)) {
      if (v.length < 2 || v === countryWords.get(cc)) continue;
      const cityHits = cn?.get(v);
      const regionHits = rn?.get(v);
      const city = cityHits && biggest(cityHits);
      const region = regionHits && biggest(regionHits);
      if (city && region) {
        // "Berlin", "Moscow", "Bucharest": the city dominates its region -> city.
        // "California", "Bavaria", "Washington": the region wins.
        const dominates = city.a1 === region.code && city.pop >= 0.35 * Math.max(region.pop, 1);
        result = dominates
          ? { type: 'city', city, precision: PRECISION.CITY_FROM_STATE }
          : { type: 'region', region, precision: PRECISION.REGION };
      } else if (city && v.length >= 3) {
        result = { type: 'city', city, precision: PRECISION.CITY_FROM_STATE };
      } else if (region) {
        result = { type: 'region', region, precision: PRECISION.REGION };
      }
      if (result) break;
    }
    stateCache.set(cacheKey, result);
    return result;
  }

  // ---- 3. station name -----------------------------------------------------------
  /** Longest phrase (up to 3 words) of `name` found in `index`; ties go to the most populous. */
  function findInName(index, name) {
    if (!index) return null;
    const tokens = key(name).split(' ').filter(Boolean);
    for (let n = Math.min(3, tokens.length); n >= 1; n--) {
      let best = null;
      for (let i = 0; i + n <= tokens.length; i++) {
        const phrase = tokens.slice(i, i + n).join(' ');
        if (n === 1 && NAME_STOPWORDS.has(phrase)) continue;
        const hits = index.get(phrase);
        if (!hits) continue;
        const hit = biggest(hits);
        if (!best || hit.pop > best.pop) best = hit;
      }
      if (best) return best;
    }
    return null;
  }

  function findCjk(list, name) {
    if (!list || !CJK_ANY.test(name)) return null;
    for (const [n, city] of list) if (name.includes(n)) return city;
    return null;
  }

  function fromName(cc, name) {
    const city = findInName(famousCities.get(cc), name) ?? findCjk(cjkByCountry.get(cc), name);
    return city ? { type: 'city', city, precision: PRECISION.CITY_FROM_NAME } : null;
  }

  /** A smaller town named in the station name, once we know which region to look in. */
  function fromNameInRegion(region, name) {
    const city = findInName(regionCities.get(region.code), name) ?? findCjk(cjkByRegion.get(region.code), name);
    return city ? { type: 'city', city, precision: PRECISION.CITY_FROM_NAME } : null;
  }

  function regionFromName(cc, name) {
    const region = findInName(regionInName.get(cc), name);
    return region ? { type: 'region', region, precision: PRECISION.REGION } : null;
  }

  function locate({ cc, state, name, lat, lng }) {
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const hit = fromCoordinates(cc, lat, lng);
      if (hit) return hit;
    }
    if (cc && state) {
      const hit = fromState(cc, state);
      if (hit?.type === 'region') return (name && fromNameInRegion(hit.region, name)) || hit;
      if (hit) return hit;
    }
    if (cc && name) {
      const hit = fromName(cc, name);
      if (hit) return hit;
      const region = regionFromName(cc, name);
      if (region) return fromNameInRegion(region.region, name) || region;
    }
    return cc ? { type: 'country', precision: PRECISION.COUNTRY } : { type: 'none', precision: PRECISION.NONE };
  }

  return { locate, regions };
}
