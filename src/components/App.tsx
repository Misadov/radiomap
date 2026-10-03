'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppEffects } from '@/hooks/useAppEffects';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useT } from '@/lib/i18n';
import { warmSearch } from '@/lib/search';
import { loadData, useData, whenStations } from '@/store/data';
import { usePlayer } from '@/store/player';
import { AboutDialog } from './AboutDialog';
import { Hint } from './Hint';
import { MapControls } from './MapControls';
import { MobileShell } from './panel/MobileShell';
import { Sidebar } from './panel/Sidebar';
import { NowPlaying } from './player/NowPlaying';
import { PlayerBar } from './player/PlayerBar';
import Starfield from './Starfield';
import { Toasts } from './Toasts';

// MapLibre is the heaviest dependency: load it as its own chunk so the panel shows up first.
const GlobeMap = dynamic(() => import('./map/GlobeMap'), { ssr: false });

function LoadError() {
  const t = useT();
  const error = useData((s) => s.error);
  if (!error) return null;
  return (
    <div className="glass-strong fixed top-1/2 left-1/2 z-[80] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 text-center animate-pop">
      <p className="text-[14px] leading-relaxed text-fg-2">{t.loadError}</p>
      <button
        type="button"
        onClick={() => loadData()}
        className="accent-gradient mt-4 h-10 rounded-xl px-5 text-[13.5px] font-bold text-[#1b1206]"
      >
        {t.retry}
      </button>
    </div>
  );
}

export default function App() {
  const mobile = useIsMobile();
  const playing = usePlayer((s) => !!s.station);
  useAppEffects();

  useEffect(() => {
    loadData();
    void whenStations().then(warmSearch);
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden" data-player={playing ? 'on' : 'off'}>
      <Starfield />
      <GlobeMap />
      {mobile ? <MobileShell /> : <Sidebar />}
      <MapControls />
      <Hint />
      {mobile ? null : <PlayerBar />}
      <NowPlaying />
      <Toasts />
      <AboutDialog />
      <LoadError />
    </main>
  );
}
