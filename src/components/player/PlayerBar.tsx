'use client';

import { useT } from '@/lib/i18n';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { Artwork } from '../ui/Artwork';
import { IconButton } from '../ui/IconButton';
import { ErrorActions, FavoriteButton, PlayButton, ShareButton, StatusLine, VolumeControl } from './controls';
import { Visualizer } from './Visualizer';
import { VizSettings } from './VizSettings';

/** Desktop: floating bar at the bottom, right of the side panel. */
export function PlayerBar() {
  const t = useT();
  const station = usePlayer((s) => s.station);
  const status = usePlayer((s) => s.status);
  const expanded = useUI((s) => s.nowPlayingOpen);
  if (!station || expanded) return null;

  const open = () => useUI.getState().setNowPlayingOpen(true);

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 left-[408px] z-30 flex justify-center lg:left-[424px]">
      <div
        data-occludes-map="bottom"
        className="glass pointer-events-auto relative flex h-[76px] w-full max-w-[820px] items-center gap-3 rounded-[22px] pr-3 pl-2.5 animate-rise"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
          <Visualizer slot="bar" className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:linear-gradient(to_top,black_30%,transparent)]" />
        </div>

        <button type="button" onClick={open} className="group relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left" aria-label={t.openPlayer}>
          <div className="relative">
            <Artwork src={station.favicon} name={station.name} size={52} radius={13} />
            {status === 'playing' ? <div className="absolute -inset-1 -z-10 rounded-[16px] bg-accent/30 blur-md" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] leading-tight font-bold text-fg group-hover:text-accent-pale">{station.name}</div>
            <StatusLine className="mt-1" />
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <ErrorActions />
          {status !== 'error' ? (
            <>
              <IconButton icon="prev" label={t.previous} size="md" tip="top" className="!hidden lg:!inline-flex" onClick={() => usePlayer.getState().step(-1)} />
              <PlayButton size={50} />
              <IconButton icon="next" label={t.next} size="md" tip="top" className="!hidden lg:!inline-flex" onClick={() => usePlayer.getState().step(1)} />
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 border-l border-line pl-2">
          <div className="hidden xl:block">
            <VolumeControl />
          </div>
          <div className="hidden lg:block xl:hidden">
            <VolumeControl compact />
          </div>
          <FavoriteButton size="sm" />
          <VizSettings side="top" />
          <div className="hidden lg:block">
            <ShareButton size="sm" />
          </div>
          <IconButton icon="expand" label={t.openPlayer} size="sm" tip="top" onClick={open} />
          <IconButton icon="x" label={t.stop} size="sm" tip="top" onClick={() => usePlayer.getState().stop()} />
        </div>
      </div>
    </div>
  );
}

/** Mobile: compact player docked at the top of the bottom sheet. */
export function MiniPlayer() {
  const t = useT();
  const station = usePlayer((s) => s.station);
  const status = usePlayer((s) => s.status);
  if (!station) return null;
  return (
    <div className="relative mx-3 mb-2.5 flex items-center gap-2.5 overflow-hidden rounded-[18px] bg-white/[0.06] p-1.5 ring-1 ring-line animate-fade-in">
      <Visualizer slot="bar" className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_top,black_30%,transparent)]" />
      <button
        type="button"
        onClick={() => useUI.getState().setNowPlayingOpen(true)}
        className="relative flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={t.openPlayer}
      >
        <Artwork src={station.favicon} name={station.name} size={44} radius={12} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-fg">{station.name}</div>
          <StatusLine className="mt-0.5" />
        </div>
      </button>
      <FavoriteButton size="sm" tip={false} />
      {status === 'error' ? (
        <IconButton icon="next" label={t.tryNext} size="md" tip={false} onClick={() => usePlayer.getState().step(1)} />
      ) : (
        <PlayButton size={42} />
      )}
    </div>
  );
}
