'use client';

import { useMemo, useState } from 'react';
import { openCountry, openPlace } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { PlaceKind } from '@/lib/types';
import { nearbyPlaces, placeContext, placeName, useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { countGenres, GenreChips } from './GenreChips';
import { SectionTitle, ViewHeader } from './ViewHeader';

export function PlaceView({ place }: { place: number }) {
  const t = useT();
  const lang = useLang();
  const places = useData((s) => s.places);
  const stations = useData((s) => s.stations);
  const derived = useData((s) => s.derived);
  const globalGenre = useUI((s) => s.genre);

  const all = useMemo(() => derived?.placeStations[place] ?? [], [derived, place]);
  const counts = useMemo(() => (stations ? countGenres(all, stations.genres) : undefined), [all, stations]);
  // Carry the globe's genre filter into the city, when the city has any of it.
  const [genre, setGenre] = useState(() => (globalGenre >= 0 ? globalGenre : -1));
  const activeGenre = counts && genre >= 0 && !counts[genre] ? -1 : genre;
  const list = useMemo(
    () => (activeGenre < 0 || !stations ? all : all.filter((i) => stations.genres[i] & (1 << activeGenre))),
    [all, activeGenre, stations],
  );
  const nearby = useMemo(() => (places ? nearbyPlaces(place, 10) : []), [places, place]);

  if (!places) return <RowsSkeleton />;

  const name = placeName(place, lang);
  const cc = places.country[place];
  const kind = places.kind[place];
  const sub = places.sub[place];
  const region = derived && sub ? derived.regionPlace.get(`${cc}|${sub}`) : undefined;
  const countryTotal = derived?.countryStations.get(cc)?.length ?? 0;

  return (
    <div className="animate-fade-in" key={place}>
      <ViewHeader
        title={name}
        right={<IconButton icon="locate" label={t.showOnMap} tip="left" onClick={() => mapBus.send({ type: 'fly-place', place })} />}
      />
      <div className="px-1">
        <div className="flex items-center gap-2 text-[12px] font-medium text-fg-3">
          <Flag cc={cc} size={16} />
          <span className="truncate">{kind === PlaceKind.Region ? `${t.region} · ${countryName(cc, lang)}` : placeContext(place, lang)}</span>
        </div>
        <h2 className="mt-1.5 text-[28px] leading-[1.05] font-extrabold tracking-[-0.03em] text-fg">{name}</h2>
        <p className="mt-2 font-mono text-[12px] text-accent">{t.stations(places.stations[place])}</p>
      </div>

      {counts && all.length > 3 ? (
        <div className="mt-4">
          <GenreChips value={activeGenre} onChange={setGenre} counts={counts} sort showCounts />
        </div>
      ) : null}

      <div className="mt-3">{stations ? <StationList items={list} /> : <RowsSkeleton count={Math.min(6, places.stations[place])} />}</div>

      {region !== undefined && region !== place ? (
        <>
          <SectionTitle>{t.region}</SectionTitle>
          <LinkRow
            onClick={() => openPlace(region, { push: true })}
            title={t.acrossRegion(placeName(region, lang))}
            meta={formatNumber(places.stations[region], lang)}
            icon={<Icon name="radio" size={17} />}
          />
        </>
      ) : null}

      {nearby.length ? (
        <>
          <SectionTitle>{t.nearby}</SectionTitle>
          <div className="flex flex-wrap gap-1.5 px-1">
            {nearby.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => openPlace(q, { push: true })}
                className="flex h-8 items-center gap-2 rounded-full border border-line px-3 text-[12.5px] font-semibold text-fg-2 transition-colors hover:border-line-2 hover:bg-elev hover:text-fg"
              >
                {placeName(q, lang)}
                <span className="font-mono text-[10.5px] text-fg-3">{formatNumber(places.stations[q], lang)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {countryTotal > all.length ? (
        <>
          <SectionTitle>{countryName(cc, lang)}</SectionTitle>
          <LinkRow
            onClick={() => openCountry(cc, { push: true })}
            title={t.allInCountry(countryName(cc, lang))}
            meta={formatNumber(countryTotal, lang)}
            icon={<Flag cc={cc} size={20} />}
          />
        </>
      ) : null}
      <div className="h-6" />
    </div>
  );
}

export function LinkRow({ title, meta, icon, onClick }: { title: string; meta?: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-elev"
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] bg-elev-2 text-accent">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">{title}</span>
      {meta ? <span className="font-mono text-[11.5px] text-fg-3">{meta}</span> : null}
      <Icon name="chevronRight" size={17} className="text-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-fg-2" />
    </button>
  );
}
