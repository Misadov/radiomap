'use client';

import { useMemo, useState } from 'react';
import { locateMe, playRandom } from '@/lib/actions';
import { useT } from '@/lib/i18n';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Eq';
import { countGenres, GenreChips } from './GenreChips';
import { SectionTitle } from './ViewHeader';

export function ExploreView() {
  const t = useT();
  const stations = useData((s) => s.stations);
  const derived = useData((s) => s.derived);
  const inView = useUI((s) => s.inView);
  const worldView = useUI((s) => s.worldView);
  const genre = useUI((s) => s.genre);
  const setGenre = useUI((s) => s.setGenre);
  const [locating, setLocating] = useState(false);

  const counts = useMemo(() => {
    if (!stations) return undefined;
    return countGenres(Array.from({ length: stations.count }, (_, i) => i), stations.genres);
  }, [stations]);

  const total = stations?.count ?? 0;
  const countries = derived?.countries.length ?? 0;

  return (
    <div className="animate-fade-in">
      <div className="px-1 pt-1">
        <p className="label-mono text-fg-3">{total ? t.heroStats(total, countries) : t.loading}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void playRandom()}
            className="group flex h-11 items-center justify-center gap-2 rounded-xl bg-elev text-[13.5px] font-semibold text-fg transition-all hover:bg-elev-2 active:scale-[0.98]"
          >
            <Icon name="shuffle" size={17} className="text-accent transition-transform duration-300 group-hover:rotate-180" />
            {t.random}
          </button>
          <button
            type="button"
            onClick={() => {
              setLocating(true);
              locateMe(() => useUI.getState().toast(t.locateFailed, 'error'));
              setTimeout(() => setLocating(false), 2500);
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elev text-[13.5px] font-semibold text-fg transition-all hover:bg-elev-2 active:scale-[0.98]"
          >
            {locating ? <Spinner size={15} className="text-accent" /> : <Icon name="locate" size={17} className="text-accent" />}
            {t.locate}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <GenreChips value={genre} onChange={setGenre} counts={counts} />
      </div>

      <SectionTitle>{worldView ? t.popularWorld : t.popularHere}</SectionTitle>
      {!stations || !inView ? (
        <RowsSkeleton />
      ) : inView.length ? (
        <StationList items={inView} />
      ) : (
        <p className="px-2 py-6 text-center text-[13px] text-fg-3">{t.noStationsForFilter}</p>
      )}
    </div>
  );
}
