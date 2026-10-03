'use client';

import { useEffect, useRef, useState } from 'react';
import { notifyLayout } from '@/hooks/useMediaQuery';
import { useT } from '@/lib/i18n';
import { usePlayer } from '@/store/player';
import { useUI, type SheetSnap } from '@/store/ui';
import { LogoMark } from '../Logo';
import { MiniPlayer } from '../player/PlayerBar';
import { PanelBody } from './PanelBody';
import { SearchBar } from './SearchBar';

const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

function useViewportHeight() {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const update = () => setH(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return h;
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  const snap = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const hasPlayer = usePlayer((s) => !!s.station);
  const vh = useViewportHeight();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startTop: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);

  const topMin = 82;
  const peekVisible = hasPlayer ? 246 : 186;
  const tops: Record<SheetSnap, number> = {
    full: topMin,
    half: Math.round(vh * 0.44),
    peek: Math.max(topMin, vh - peekVisible),
  };
  const top = tops[snap];

  useEffect(() => {
    const id = setTimeout(notifyLayout, 420);
    return () => clearTimeout(id);
  }, [top]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { startY: e.clientY, startTop: el.getBoundingClientRect().top, lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false };
    el.style.transition = 'none';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.v;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    el.style.top = `${Math.min(vh - 90, Math.max(topMin, d.startTop + dy))}px`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = '';
    let target: SheetSnap;
    if (!d.moved) {
      target = snap === 'peek' ? 'half' : 'peek';
    } else if (Math.abs(d.v) > 0.45) {
      const i = ORDER.indexOf(snap);
      target = ORDER[Math.max(0, Math.min(2, i + (d.v < 0 ? 1 : -1)))];
    } else {
      const current = el.getBoundingClientRect().top;
      target = ORDER.reduce((best, s) => (Math.abs(tops[s] - current) < Math.abs(tops[best] - current) ? s : best), snap);
    }
    el.style.top = `${tops[target]}px`;
    setSheet(target);
  };

  return (
    <div
      ref={ref}
      data-occludes-map="bottom"
      className="glass-strong fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[26px] pb-[env(safe-area-inset-bottom)] transition-[top] duration-[420ms] ease-[cubic-bezier(0.2,0.9,0.25,1)]"
      style={{ top }}
    >
      <div
        className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        aria-label="Resize panel"
      >
        <span className="h-1.5 w-10 rounded-full bg-white/20" />
      </div>
      {children}
    </div>
  );
}

/** Mobile: search on top, everything else in a draggable bottom sheet. */
export function MobileShell() {
  const t = useT();
  return (
    <>
      <div data-occludes-map="top" className="fixed inset-x-0 top-0 z-30 px-2.5 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="glass flex items-center gap-1.5 rounded-[20px] p-1.5">
          <button
            type="button"
            onClick={() => useUI.getState().setAboutOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
            aria-label={t.about}
          >
            <LogoMark size={30} />
          </button>
          <div className="min-w-0 flex-1">
            <SearchBar onFocus={() => useUI.getState().setSheet('full')} />
          </div>
        </div>
      </div>
      <BottomSheet>
        <MiniPlayer />
        <PanelBody />
      </BottomSheet>
    </>
  );
}
