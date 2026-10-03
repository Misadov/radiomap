'use client';

import { useState } from 'react';
import { locateMe, playRandom } from '@/lib/actions';
import { useT } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { useUI } from '@/store/ui';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Spinner } from './ui/Eq';
import { IconButton } from './ui/IconButton';

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
        <button type="button" onClick={() => mapBus.send({ type: 'tilt' })} className="glass flex size-10 items-center justify-center rounded-xl font-mono text-[12px] font-bold text-fg-2">3D</button>
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
        <button
          type="button"
          onClick={() => mapBus.send({ type: 'tilt' })}
          aria-label={t.tilt}
          data-tip={t.tilt}
          data-tip-side="left"
          className="tip relative flex size-10 items-center justify-center rounded-xl font-mono text-[12px] font-bold text-fg-2 hover:bg-elev-2 hover:text-fg"
        >
          3D
        </button>
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
