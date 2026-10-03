'use client';

import { useEffect, useMemo, useState } from 'react';
import { openPlace, openCountry } from '@/lib/actions';
import { genresOf, genreLabel } from '@/lib/genres';
import { countryName, languageName, useLang, useT } from '@/lib/i18n';
import { stationHomepage } from '@/lib/radio-browser';
import { similarStations, trackSearchLinks } from '@/lib/similar';
import { stationAt, stationLocation, useData } from '@/store/data';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { StationRow } from '../station/StationRow';
import { Artwork } from '../ui/Artwork';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ErrorActions, FavoriteButton, PlayButton, ShareButton, StatusLine, VolumeControl } from './controls';
import { Visualizer } from './Visualizer';

const homepageCache = new Map<string, string | null>();

export function NowPlaying() {
  const t = useT();
  const lang = useLang();
  const mobile = useIsMobile();
  const open = useUI((s) => s.nowPlayingOpen);
  const station = usePlayer((s) => s.station);
  const track = usePlayer((s) => s.track);
  const status = usePlayer((s) => s.status);
  const version = useData((s) => s.version);
  // Homepages aren't in our dataset; ask radio-browser once per station.
  const [, setFetched] = useState(0);
  const id = station?.id;
  const homepage = id ? (homepageCache.get(id) ?? null) : null;
  useEffect(() => {
    if (!open || !id || homepageCache.has(id)) return;
    let alive = true;
    void stationHomepage(id).then((url) => {
      homepageCache.set(id, url);
      if (alive) setFetched((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [open, id]);

  const similar = useMemo(() => {
    void version;
    return station && station.index >= 0 ? similarStations(station, 6) : [];
  }, [station, version]);

  if (!open || !station) return null;
  const close = () => useUI.getState().setNowPlayingOpen(false);
  const genres = genresOf(station.genres);
  const where = stationLocation(station, lang);

  return (
    <div
      data-occludes-map={mobile ? undefined : 'right'}
      className={
        mobile
          ? 'fixed inset-0 z-50 flex flex-col bg-[#07080f] animate-rise pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] [background-image:radial-gradient(120%_60%_at_50%_0%,rgba(255,150,60,0.14),transparent_60%)]'
          : 'glass fixed top-3 right-3 bottom-3 z-40 flex w-[380px] flex-col overflow-hidden rounded-[26px] animate-rise'
      }
      role="dialog"
      aria-label={t.nowPlaying}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <span className="label-mono text-fg-3">{t.nowPlaying}</span>
        <IconButton icon={mobile ? 'chevronDown' : 'x'} label={t.close} size="sm" tip="left" onClick={close} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        <div className="relative mx-auto mt-1 aspect-square w-full max-w-[300px]">
          <Visualizer variant="ring" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-[22%] overflow-hidden rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
            <Artwork src={station.favicon} name={station.name} size={400} radius={28} className="!h-full !w-full" />
          </div>
        </div>

        <div className="mt-2 text-center">
          <h2 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-balance text-fg">{station.name}</h2>
          <button
            type="button"
            onClick={() => {
              if (station.place >= 0) openPlace(station.place);
              else if (station.country) openCountry(station.country);
              if (mobile) close();
            }}
            className="mx-auto mt-1.5 flex max-w-full items-center justify-center gap-1.5 rounded-lg px-2 py-0.5 text-[13px] font-medium text-fg-2 hover:bg-elev hover:text-fg"
          >
            <Flag cc={station.country} size={16} />
            <span className="truncate">{[where, where !== countryName(station.country, lang) ? countryName(station.country, lang) : ''].filter(Boolean).join(', ')}</span>
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <StatusLine className="justify-center" showWhere={false} />
        </div>
        <div className="mt-2 flex justify-center">
          <ErrorActions />
        </div>

        <div className="mt-5 flex items-center justify-center gap-4">
          <IconButton icon="prev" label={t.previous} size="lg" tip="top" onClick={() => usePlayer.getState().step(-1)} />
          <PlayButton size={66} />
          <IconButton icon="next" label={t.next} size="lg" tip="top" onClick={() => usePlayer.getState().step(1)} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl bg-elev px-2 py-1.5">
          <VolumeControl />
          <div className="flex items-center">
            <FavoriteButton size="sm" />
            <ShareButton size="sm" />
            {homepage ? (
              <a
                href={homepage}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t.website}
                data-tip={t.website}
                data-tip-side="top"
                className="tip relative flex size-8 items-center justify-center rounded-[10px] text-fg-2 hover:bg-elev-2 hover:text-fg"
              >
                <Icon name="external" size={17} />
              </a>
            ) : null}
          </div>
        </div>

        {track && status === 'playing' ? (
          <div className="mt-4 rounded-2xl border border-line p-3.5">
            <div className="label-mono text-fg-3">{t.onAir}</div>
            <div className="mt-1 text-[14.5px] leading-snug font-semibold text-fg">{track}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {trackSearchLinks(track).map((l) => (
                <a
                  key={l.id}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-7 items-center gap-1 rounded-full bg-elev px-2.5 text-[11.5px] font-semibold text-fg-2 hover:bg-elev-2 hover:text-fg"
                >
                  {l.label}
                  <Icon name="external" size={12} />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <span key={g.id} className="flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12px] font-semibold text-fg-2">
              <span className="size-1.5 rounded-full" style={{ background: g.color }} />
              {genreLabel(g, lang)}
            </span>
          ))}
          {[station.codec, station.bitrate ? `${station.bitrate} ${t.kbps}` : '', languageName(station.language, lang)]
            .filter(Boolean)
            .map((x) => (
              <span key={x} className="flex h-7 items-center rounded-full bg-elev px-2.5 font-mono text-[11px] text-fg-3">
                {x}
              </span>
            ))}
        </div>

        {similar.length ? (
          <div className="mt-6">
            <div className="label-mono mb-2 px-1 text-fg-3">{t.similar}</div>
            <div className="-mx-2.5">
              {similar.map((i) => (
                <StationRow key={i} station={stationAt(i)} queue={similar} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
