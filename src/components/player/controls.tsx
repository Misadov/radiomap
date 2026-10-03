'use client';

import { useLang, useT } from '@/lib/i18n';
import { stationLocation, toSaved } from '@/store/data';
import { useIsFavorite, useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { Spinner } from '../ui/Eq';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export function PlayButton({ size = 48 }: { size?: number }) {
  const t = useT();
  const status = usePlayer((s) => s.status);
  const playing = status === 'playing' || status === 'loading';
  return (
    <button
      type="button"
      onClick={() => usePlayer.getState().toggle()}
      aria-label={playing ? t.pause : t.play}
      className="accent-gradient relative flex shrink-0 items-center justify-center rounded-full text-[#1b1206] shadow-[0_10px_34px_-10px_rgba(255,140,60,0.9),inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 hover:scale-[1.05] active:scale-95"
      style={{ width: size, height: size }}
    >
      {status === 'loading' ? (
        <Spinner size={Math.round(size * 0.38)} className="opacity-80" />
      ) : (
        <Icon name={playing ? 'pause' : 'play'} size={Math.round(size * 0.44)} className={playing ? '' : 'translate-x-[1.5px]'} />
      )}
    </button>
  );
}

export function FavoriteButton({ size = 'md' as 'sm' | 'md' | 'lg', tip = 'top' as 'top' | 'bottom' | 'left' | 'right' | false }) {
  const t = useT();
  const station = usePlayer((s) => s.station);
  const favorite = useIsFavorite(station?.id);
  if (!station?.id) return null;
  return (
    <IconButton
      icon={favorite ? 'heartFill' : 'heart'}
      label={favorite ? t.removeFavorite : t.addFavorite}
      size={size}
      tip={tip}
      className={favorite ? '!text-[#ff6b7d]' : ''}
      onClick={(e) => {
        e.stopPropagation();
        const added = useLibrary.getState().toggleFavorite(toSaved(station));
        useUI.getState().toast(added ? t.addedFavorite : t.removedFavorite);
      }}
    />
  );
}

export function ShareButton({ size = 'md' as 'sm' | 'md' | 'lg', tip = 'top' as 'top' | 'bottom' | false }) {
  const t = useT();
  const station = usePlayer((s) => s.station);
  if (!station?.id) return null;
  const share = async () => {
    const url = `${window.location.origin}/?station=${station.id}`;
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: `${station.name} — RadioMap`, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      useUI.getState().toast(t.linkCopied);
    } catch {
      window.prompt(t.share, url);
    }
  };
  return <IconButton icon="share" label={t.share} size={size} tip={tip} onClick={() => void share()} />;
}

export function VolumeControl({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const volume = useLibrary((s) => s.volume);
  const muted = useLibrary((s) => s.muted);
  const level = muted ? 0 : volume;
  const icon = level === 0 ? 'volumeMute' : level < 0.5 ? 'volumeLow' : 'volume';
  return (
    <div
      className="flex items-center gap-1.5"
      onWheel={(e) => {
        const lib = useLibrary.getState();
        lib.setVolume(lib.volume + (e.deltaY < 0 ? 0.05 : -0.05));
      }}
    >
      <IconButton
        icon={icon}
        label={muted ? t.unmute : t.mute}
        size="sm"
        tip="top"
        onClick={() => {
          const lib = useLibrary.getState();
          if (lib.muted || lib.volume === 0) lib.setVolume(lib.volume || 0.6);
          else lib.setMuted(true);
        }}
      />
      {compact ? null : (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label={t.volume}
          onChange={(e) => useLibrary.getState().setVolume(Number(e.target.value))}
          className="range w-24"
          style={{ ['--fill' as string]: `${level * 100}%` }}
        />
      )}
    </div>
  );
}

/** One line under the station name: live state, current track or the problem. */
export function StatusLine({ className = '', showWhere = true }: { className?: string; showWhere?: boolean }) {
  const t = useT();
  const lang = useLang();
  const station = usePlayer((s) => s.station);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const track = usePlayer((s) => s.track);
  if (!station) return null;

  if (status === 'error') {
    const text = error === 'insecure' ? t.errorInsecure : error === 'unsupported' ? t.errorUnsupported : t.errorUnavailable;
    return (
      <div className={`flex min-w-0 items-center gap-1.5 text-[12.5px] text-[#ff8a8a] ${className}`}>
        <Icon name="alert" size={14} className="shrink-0" />
        <span className="truncate">{text}</span>
      </div>
    );
  }
  const where = stationLocation(station, lang);
  return (
    <div className={`flex min-w-0 items-center gap-2 text-[12.5px] text-fg-3 ${className}`}>
      {status === 'loading' ? (
        <span className="truncate">{t.connecting}</span>
      ) : status === 'playing' ? (
        <>
          <span className="flex shrink-0 items-center gap-1 rounded-[5px] bg-live/15 px-1.5 py-[1px] font-mono text-[10px] font-semibold tracking-wider text-live uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-live" />
            {t.live}
          </span>
          {track || showWhere ? (
            <span className="truncate" title={track ?? where}>
              {track ?? where}
            </span>
          ) : null}
        </>
      ) : (
        <span className="truncate">{status === 'paused' ? `${t.paused} · ${where}` : where}</span>
      )}
    </div>
  );
}

export function ErrorActions() {
  const t = useT();
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const station = usePlayer((s) => s.station);
  if (status !== 'error' || !station) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => usePlayer.getState().step(1)}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-elev-2 px-3 text-[12.5px] font-semibold text-fg hover:bg-white/[0.12]"
      >
        <Icon name="next" size={14} />
        {t.tryNext}
      </button>
      {error === 'insecure' && station.url ? (
        <a
          href={station.url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-fg-2 hover:bg-elev hover:text-fg"
        >
          <Icon name="external" size={14} />
          {t.openStream}
        </a>
      ) : null}
    </div>
  );
}
