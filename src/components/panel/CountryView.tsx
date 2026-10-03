'use client';

import { useMemo, useState } from 'react';
import { openPlace } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { placeName, useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Flag } from '../ui/Flag';
import { IconButton } from '../ui/IconButton';
import { countGenres, GenreChips } from './GenreChips';
import { SectionTitle, ViewHeader } from './ViewHeader';

export function CountryView({ cc }: { cc: string }) {
  const t = useT();
  const lang = useLang();
  const places = useData((s) => s.places);
  const stations = useData((s) => s.stations);
  const derived = useData((s) => s.derived);
  const globalGenre = useUI((s) => s.genre);

  const all = useMemo(() => derived?.countryStations.get(cc) ?? [], [derived, cc]);
  const counts = useMemo(() => (stations ? countGenres(all, stations.genres) : undefined), [all, stations]);
  const [genre, setGenre] = useState(globalGenre);
  const activeGenre = counts && genre >= 0 && !counts[genre] ? -1 : genre;
  const list = useMemo(
    () => (activeGenre < 0 || !stations ? all : all.filter((i) => stations.genres[i] & (1 << activeGenre))),
    [all, activeGenre, stations],
  );
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const topPlaces = useMemo(() => {
    if (!places) return [];
    const out: number[] = [];
    for (let p = 0; p < places.count; p++) if (places.country[p] === cc) out.push(p);
    return out; // places are already sorted by station count
  }, [places, cc]);

  const name = countryName(cc, lang);
  const visiblePlaces = showAllPlaces ? topPlaces.slice(0, 60) : topPlaces.slice(0, 12);

  return (
    <div className="animate-fade-in" key={cc}>
      <ViewHeader
        title={name}
        right={<IconButton icon="locate" label={t.showOnMap} tip="left" onClick={() => mapBus.send({ type: 'fly-country', cc })} />}
      />
      <div className="flex items-center gap-4 px-1">
        <Flag cc={cc} size={56} className="!rounded-[7px] shadow-xl" />
        <div className="min-w-0">
          <h2 className="text-[26px] leading-[1.05] font-extrabold tracking-[-0.03em] text-fg">{name}</h2>
          <p className="mt-1.5 font-mono text-[12px] text-accent">
            {derived ? `${t.stations(all.length)} · ${t.places(topPlaces.length)}` : t.loading}
          </p>
        </div>
      </div>

      {topPlaces.length ? (
        <>
          <SectionTitle
            aside={
              topPlaces.length > 12 ? (
                <button type="button" onClick={() => setShowAllPlaces((v) => !v)} className="text-[12px] font-semibold text-fg-3 hover:text-fg">
                  {showAllPlaces ? t.showLess : t.showAll}
                </button>
              ) : null
            }
          >
            {t.sectionPlaces}
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5 px-1">
            {visiblePlaces.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => openPlace(p, { push: true })}
                className="flex h-8 items-center gap-2 rounded-full border border-line px-3 text-[12.5px] font-semibold text-fg-2 transition-colors hover:border-line-2 hover:bg-elev hover:text-fg"
              >
                {placeName(p, lang)}
                <span className="font-mono text-[10.5px] text-fg-3">{formatNumber(places!.stations[p], lang)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>{t.sectionStations}</SectionTitle>
      {counts && all.length > 3 ? (
        <div className="mb-2">
          <GenreChips value={activeGenre} onChange={setGenre} counts={counts} sort showCounts />
        </div>
      ) : null}
      {stations ? <StationList items={list} /> : <RowsSkeleton />}
      <div className="h-6" />
    </div>
  );
}
