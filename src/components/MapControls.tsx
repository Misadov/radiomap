'use client';

import { useState } from 'react';
import { locateMe, playRandom } from '@/lib/actions';
import { useT } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { useLibrary } from '@/store/library';
import { useUI } from '@/store/ui';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Spinner } from './ui/Eq';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/IconButton';

/** Toggle with a visible on/off state: lit when 3D is on. */
function ModeToggles({ glass = false, tip }: { glass?: boolean; tip?: 'left' | false }) {
  const t = useT();
  const view3d = useLibrary((s) => s.settings.view3d);
  const basemap = useLibrary((s) => s.settings.basemap);
  const set = useLibrary((s) => s.setSettings);
  const base = `tip relative flex size-10 items-center justify-center rounded-xl transition-colors ${glass ? 'glass' : ''}`;
  const sat = basemap === 'satellite';
  return (
    <>
      <button
        type="button"
        onClick={() => set({ view3d: !view3d })}
        aria-pressed={view3d}
        aria-label={view3d ? t.mode3dOn : t.mode3dOff}
        data-tip={tip ? (view3d ? t.mode3dOn : t.mode3dOff) : undefined}
        data-tip-side={tip || undefined}
        className={`${base} font-mono text-[12.5px] font-extrabold ${view3d ? '!bg-accent-soft text-accent ring-1 ring-accent/50' : 'text-fg-2 hover:bg-elev-2 hover:text-fg'}`}
      >
        {view3d ? '3D' : '2D'}
      </button>
      <button
        type="button"
        onClick={() => set({ basemap: sat ? 'map' : 'satellite' })}
        aria-label={sat ? t.basemapSatellite : t.basemapMap}
        data-tip={tip ? `${sat ? t.basemapSatellite : t.basemapMap} → ${sat ? t.basemapMap : t.basemapSatellite}` : undefined}
        data-tip-side={tip || undefined}
        className={`${base} text-fg-2 hover:bg-elev-2 hover:text-fg`}
      >
        <Icon name={sat ? 'satellite' : 'map'} size={19} className={sat ? 'text-[#5ef2d0]' : ''} />
      </button>
    </>
  );
}

export function MapControls() {
  const t = useT();
  const mobile = useIsMobile();
  const nowPlaying = useUI((s) => s.nowPlayingOpen);
  const [locating, setLocating] = useState(false);

  const locate = () => {
    setLocating(true);
    locateMe(() => useUI.getState().toast(t.locateFailed, 'error'));
    setTimeout(() => setLocating(false), 2500);
  };

  if (mobile) {
    return (
      <div className="fixed top-[calc(max(10px,env(safe-area-inset-top))+74px)] right-2.5 z-20 flex flex-col gap-2">
        <IconButton icon="shuffle" label={t.randomHint} variant="glass" size="md" tip={false} onClick={() => void playRandom()} />
        <IconButton icon="locate" label={t.locateHint} variant="glass" size="md" tip={false} onClick={locate}>
          {locating ? <Spinner size={14} className="absolute text-accent" /> : null}
        </IconButton>
        <IconButton icon="globe" label={t.resetView} variant="glass" size="md" tip={false} onClick={() => mapBus.send({ type: 'reset' })} />
        <ModeToggles glass tip={false} />
      </div>
    );
  }

  return (
    <div
      className="fixed top-3 z-20 flex flex-col gap-2 transition-[right] duration-300"
      style={{ right: nowPlaying ? 404 : 12 }}
    >
      <div className="glass flex flex-col rounded-[16px] p-1">
        <IconButton icon="plus" label={t.zoomIn} tip="left" onClick={() => mapBus.send({ type: 'zoom', delta: 1 })} />
        <IconButton icon="minus" label={t.zoomOut} tip="left" onClick={() => mapBus.send({ type: 'zoom', delta: -1 })} />
      </div>
      <div className="glass flex flex-col gap-0.5 rounded-[16px] p-1">
        <ModeToggles tip="left" />
      </div>
      <div className="glass flex flex-col rounded-[16px] p-1">
        <IconButton icon="globe" label={t.resetView} tip="left" onClick={() => mapBus.send({ type: 'reset' })} />
        <IconButton icon="locate" label={t.locateHint} tip="left" onClick={locate}>
          {locating ? <Spinner size={14} className="absolute text-accent" /> : null}
        </IconButton>
        <IconButton icon="shuffle" label={t.randomHint} tip="left" onClick={() => void playRandom()} />
      </div>
    </div>
  );
}
