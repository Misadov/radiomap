'use client';

import { useMemo, useState } from 'react';
import { openPlace } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { placeName, useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
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
  const visiblePlaces = showAllPlaces ? topPlaces : topPlaces.slice(0, 15);

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
              topPlaces.length > 15 ? (
                <button type="button" onClick={() => setShowAllPlaces((v) => !v)} className="text-[12px] font-semibold text-fg-3 hover:text-fg">
                  {showAllPlaces ? t.showLess : t.showAll}
                </button>
              ) : null
            }
          >
            {t.sectionPlaces}
          </SectionTitle>
          <div className="flex flex-col">
            {visiblePlaces.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => openPlace(p, { push: true })}
                className="group flex h-11 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-elev"
              >
                <Icon name="pin" size={16} className="shrink-0 text-accent/80" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg-2 group-hover:text-fg">{placeName(p, lang)}</span>
                <span className="shrink-0 font-mono text-[11.5px] text-fg-3">{formatNumber(places!.stations[p], lang)}</span>
                <Icon name="chevronRight" size={16} className="shrink-0 text-fg-3" />
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
