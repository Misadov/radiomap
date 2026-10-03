// Text helpers shared by the data pipeline.

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;
const MARKS = /\p{M}+/gu;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Trim, drop control / zero-width characters and collapse whitespace. */
export function clean(value) {
  return String(value ?? '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower-case, strip diacritics. "São Paulo" -> "sao paulo". */
export function fold(value) {
  return clean(value).normalize('NFKD').replace(MARKS, '').toLowerCase();
}

/** fold() + punctuation collapsed to single spaces. Used as a lookup key. */
export function key(value) {
  return fold(value).replace(NON_WORD, ' ').trim();
}

/** Split a folded string into word tokens. */
export function words(value) {
  const k = key(value);
  return k ? k.split(' ') : [];
}

export function isHttpUrl(value) {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value ?? '');
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
