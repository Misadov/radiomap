'use client';

import { useDeferredValue, useMemo } from 'react';
import { openCountry, openPlace } from '@/lib/actions';
import { GENRES, genreLabel } from '@/lib/genres';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { search } from '@/lib/search';
import { PlaceKind } from '@/lib/types';
import { placeContext, placeName, useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { RowsSkeleton, StationList } from '../station/StationList';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
import { EmptyState, SectionTitle } from './ViewHeader';

export function SearchResults() {
  const t = useT();
  const lang = useLang();
  const query = useUI((s) => s.query);
  const deferred = useDeferredValue(query);
  const version = useData((s) => s.version);
  const places = useData((s) => s.places);
  const derived = useData((s) => s.derived);

  const results = useMemo(() => {
    void version; // re-run once stations arrive
    return search(deferred);
  }, [deferred, version]);

  if (!derived) return <RowsSkeleton />;

  const nothing = !results.places.length && !results.countries.length && !results.genres.length && !results.stations.length;
  if (nothing && results.query) {
    return (
      <EmptyState icon={<Icon name="search" size={24} />} title={t.noResults(query.trim())} text={t.noResultsHint} />
    );
  }

  const clear = () => useUI.getState().setQuery('');

  return (
    <div className="animate-fade-in pb-6">
      {results.places.length || results.countries.length ? (
        <>
          <SectionTitle>{t.sectionPlaces}</SectionTitle>
          <div className="flex flex-col">
            {results.countries.map((cc) => (
              <ResultRow
                key={cc}
                icon={<Flag cc={cc} size={22} />}
                title={countryName(cc, lang)}
                subtitle={t.sectionCountries}
                meta={formatNumber(derived.countryStations.get(cc)?.length ?? 0, lang)}
                onClick={() => {
                  clear();
                  openCountry(cc);
                }}
              />
            ))}
            {results.places.map((p) => (
              <ResultRow
                key={p}
                icon={<Icon name={places?.kind[p] === PlaceKind.Region ? 'radio' : 'pin'} size={18} />}
                title={placeName(p, lang)}
                subtitle={placeContext(p, lang)}
                meta={formatNumber(places?.stations[p] ?? 0, lang)}
                onClick={() => {
                  clear();
                  openPlace(p);
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {results.genres.length ? (
        <>
          <SectionTitle>{t.sectionGenres}</SectionTitle>
          <div className="flex flex-wrap gap-1.5 px-1">
            {results.genres.map((bit) => {
              const g = GENRES[bit];
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    useUI.getState().setGenre(bit);
                    useUI.getState().select(null);
                    clear();
                  }}
                  className="flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg transition-colors hover:border-line-2 hover:bg-elev"
                >
                  <span className="size-2 rounded-full" style={{ background: g.color, boxShadow: `0 0 10px ${g.color}` }} />
                  {genreLabel(g, lang)}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {results.stations.length ? (
        <>
          <SectionTitle>{t.sectionStations}</SectionTitle>
          <StationList items={results.stations} />
        </>
      ) : null}
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  meta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-elev">
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] bg-elev-2 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-fg-3">{subtitle}</span>
      </span>
      <span className="font-mono text-[11.5px] text-fg-3">{meta}</span>
    </button>
  );
}
