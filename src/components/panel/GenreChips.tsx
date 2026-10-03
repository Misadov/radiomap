'use client';

import { GENRES, genreLabel } from '@/lib/genres';
import { formatNumber, useLang, useT } from '@/lib/i18n';

/** Horizontal genre filter. `counts[bit]` hides genres with no stations; `sort` orders by count. */
export function GenreChips({
  value,
  onChange,
  counts,
  sort = false,
  showCounts = false,
}: {
  value: number;
  onChange: (genre: number) => void;
  counts?: ArrayLike<number>;
  sort?: boolean;
  showCounts?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  let list = counts ? GENRES.filter((g) => counts[g.bit] > 0 || g.bit === value) : GENRES;
  if (sort && counts) list = [...list].sort((a, b) => counts[b.bit] - counts[a.bit]);
  // Keep the active genre in sight.
  if (value >= 0) list = [...list.filter((g) => g.bit === value), ...list.filter((g) => g.bit !== value)];

  const chip = (active: boolean) =>
    `flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-all duration-150 active:scale-95 ${
      active ? 'border-accent/50 bg-accent-soft text-accent-pale' : 'border-line text-fg-2 hover:border-line-2 hover:bg-elev hover:text-fg'
    }`;

  return (
    <div className="no-scrollbar mask-fade-x -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5" role="toolbar" aria-label="Genres">
      <button type="button" className={chip(value < 0)} onClick={() => onChange(-1)} aria-pressed={value < 0}>
        {t.allGenres}
      </button>
      {list.map((g) => (
        <button
          key={g.id}
          type="button"
          className={chip(value === g.bit)}
          onClick={() => onChange(value === g.bit ? -1 : g.bit)}
          aria-pressed={value === g.bit}
        >
          <span className="size-1.5 rounded-full" style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }} />
          {genreLabel(g, lang)}
          {showCounts && counts ? <span className="font-mono text-[10.5px] font-medium text-fg-3">{formatNumber(counts[g.bit], lang)}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Station count per genre bit for a list of station indices. */
export function countGenres(indices: number[], genres: number[]): Int32Array {
  const counts = new Int32Array(GENRES.length);
  for (const i of indices) {
    let mask = genres[i];
    while (mask) {
      const bit = 31 - Math.clz32(mask);
      counts[bit]++;
      mask &= ~(1 << bit);
    }
  }
  return counts;
}
