const MARKS = /\p{M}+/gu;

/** Lower-case and strip diacritics: "São Paulo" -> "sao paulo", "Ёлка" -> "елка". */
export function fold(value: string): string {
  return value.normalize('NFKD').replace(MARKS, '').toLowerCase();
}

/** Deterministic hue (0-359) for a string — used for artwork placeholders. */
export function hueOf(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/** Up to two letters/digits that represent a station name. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(radio|the|fm|am|радио)$/i.test(w));
  const pick = words.length ? words : name.split(/\s+/);
  const letters = pick.slice(0, 2).map((w) => [...w][0] ?? '');
  return letters.join('').toUpperCase() || '♪';
}
