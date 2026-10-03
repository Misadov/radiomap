'use client';

import { useMemo, useState } from 'react';
import { locateMe, openCountry, playRandom } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { useData } from '@/store/data';
import { useLibrary } from '@/store/library';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Eq';
import { chipClass, countGenres, GenreChips } from './GenreChips';
import { SectionTitle } from './ViewHeader';

export function ExploreView() {
  const t = useT();
  const stations = useData((s) => s.stations);
  const derived = useData((s) => s.derived);
  const inView = useUI((s) => s.inView);
  const worldView = useUI((s) => s.worldView);
  const genre = useUI((s) => s.genre);
  const popular = useUI((s) => s.popular);
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
        <GenreChips
          value={genre}
          counts={counts}
          allActive={genre < 0 && !popular}
          onChange={(g) => {
            useUI.getState().setGenre(g);
            if (g < 0) useUI.getState().setPopular(false);
          }}
          leading={
            <button type="button" className={chipClass(popular)} aria-pressed={popular} onClick={() => useUI.getState().setPopular(!popular)}>
              <Icon name="sparkles" size={14} />
              {t.popular}
            </button>
          }
        />
      </div>

      {popular ? (
        <>
          <SectionTitle>{worldView ? t.popularWorld : t.popularHere}</SectionTitle>
          {!stations || !inView ? (
            <RowsSkeleton />
          ) : inView.length ? (
            <StationList items={inView} />
          ) : (
            <p className="px-2 py-6 text-center text-[13px] text-fg-3">{t.noStationsForFilter}</p>
          )}
        </>
      ) : (
        <CountryList genre={genre} />
      )}
    </div>
  );
}

function CountryList({ genre }: { genre: number }) {
  const t = useT();
  const lang = useLang();
  const stations = useData((s) => s.stations);
  const derived = useData((s) => s.derived);
  const visited = useLibrary((s) => s.passport.countries);

  const list = useMemo(() => {
    if (!derived || !stations) return null;
    const rows = derived.countries.map(({ cc, count }) => {
      if (genre < 0) return { cc, count };
      let n = 0;
      for (const i of derived.countryStations.get(cc) ?? []) if (stations.genres[i] & (1 << genre)) n++;
      return { cc, count: n };
    });
    return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  }, [derived, stations, genre]);

  if (!list) return <RowsSkeleton />;
  return (
    <>
      <SectionTitle aside={<span className="font-mono text-[11px] text-fg-3">{formatNumber(list.length, lang)}</span>}>{t.sectionCountries}</SectionTitle>
      <div className="flex flex-col">
        {list.map(({ cc, count }) => (
          <button
            key={cc}
            type="button"
            onClick={() => openCountry(cc, { push: true })}
            className="group flex h-12 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-elev"
          >
            <Flag cc={cc} size={26} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg-2 group-hover:text-fg">{countryName(cc, lang)}</span>
            {visited[cc] ? <span title={t.visited} className="size-1.5 shrink-0 rounded-full bg-[#5ef2d0] shadow-[0_0_8px_#5ef2d0]" /> : null}
            <span className="shrink-0 font-mono text-[11.5px] text-fg-3">{formatNumber(count, lang)}</span>
            <Icon name="chevronRight" size={16} className="shrink-0 text-fg-3" />
          </button>
        ))}
      </div>
    </>
  );
}
