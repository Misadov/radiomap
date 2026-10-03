'use client';

import { memo } from 'react';
import { genreLabel, primaryGenre } from '@/lib/genres';
import { useLang, useT } from '@/lib/i18n';
import type { Station } from '@/lib/types';
import { stationLocation, toSaved, useData } from '@/store/data';
import { useIsFavorite, useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { Artwork } from '../ui/Artwork';
import { Eq, Spinner } from '../ui/Eq';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';

export const ROW_HEIGHT = 62;

function subtitle(station: Station, lang: ReturnType<typeof useLang>) {
  const where = stationLocation(station, lang);
  const genre = primaryGenre(station.genres, useData.getState().derived?.genreCounts);
  const tag = genre ? genreLabel(genre, lang) : station.tags[0];
  return [where, tag].filter(Boolean).join(' · ');
}

export const StationRow = memo(function StationRow({
  station,
  queue,
  onPlay,
}: {
  station: Station;
  queue?: number[];
  onPlay?: (station: Station) => void;
}) {
  const t = useT();
  const lang = useLang();
  const isCurrent = usePlayer((s) => {
    const current = s.station;
    if (!current) return false;
    if (station.index >= 0 && current.index >= 0) return current.index === station.index;
    return !!station.id && current.id === station.id;
  });
  const status = usePlayer((s) => (isCurrent ? s.status : 'idle'));
  const favorite = useIsFavorite(station.id);

  const play = () => {
    const player = usePlayer.getState();
    if (isCurrent && (status === 'playing' || status === 'loading')) player.toggle();
    else if (isCurrent && status === 'paused') player.toggle();
    else {
      onPlay?.(station);
      void player.play(station, queue);
    }
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!station.id) return;
    const added = useLibrary.getState().toggleFavorite(toSaved(station));
    useUI.getState().toast(added ? t.addedFavorite : t.removedFavorite);
  };

  const live = isCurrent && (status === 'playing' || status === 'loading');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={play}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play();
        }
      }}
      aria-label={`${live ? t.pause : t.play}: ${station.name}`}
      className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 outline-none transition-colors duration-150 hover:bg-elev focus-visible:bg-elev-2 ${isCurrent ? 'bg-accent-soft hover:bg-accent-soft' : ''}`}
      style={{ height: ROW_HEIGHT - 4 }}
    >
      <div className="relative">
        <Artwork src={station.favicon} name={station.name} size={42} radius={11} />
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-[11px] bg-black/55 text-white transition-opacity duration-150 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {isCurrent && status === 'loading' ? (
            <Spinner size={15} className="text-accent-pale" />
          ) : live ? (
            <>
              <Eq className="text-accent group-hover:hidden" />
              <Icon name="pause" size={16} className="hidden group-hover:block" />
            </>
          ) : (
            <Icon name="play" size={16} />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[14px] leading-tight font-semibold ${isCurrent ? 'text-accent-pale' : 'text-fg'}`}>{station.name}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight text-fg-3">
          <Flag cc={station.country} size={14} />
          <span className="truncate">{subtitle(station, lang)}</span>
        </div>
      </div>
      {station.id ? (
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={favorite ? t.removeFavorite : t.addFavorite}
          aria-pressed={favorite}
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-150 hover:bg-elev-2 active:scale-90 ${favorite ? 'text-[#ff6b7d]' : 'text-fg-4 opacity-100 hover:text-fg-2 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'}`}
        >
          <Icon name={favorite ? 'heartFill' : 'heart'} size={18} />
        </button>
      ) : null}
    </div>
  );
});
