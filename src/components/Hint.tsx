'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useT } from '@/lib/i18n';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { Icon } from './ui/Icon';

/** First-visit nudge over the globe; gone after the first real interaction. */
export function Hint() {
  const t = useT();
  const mobile = useIsMobile();
  const [state, setState] = useState<'wait' | 'show' | 'gone'>('wait');

  useEffect(() => {
    const timer = setTimeout(() => setState((s) => (s === 'wait' ? 'show' : s)), 2600);
    const gone = () => setState('gone');
    const offUI = useUI.subscribe((s) => (s.selection || s.query) && gone());
    const offPlayer = usePlayer.subscribe((s) => s.station && gone());
    return () => {
      clearTimeout(timer);
      offUI();
      offPlayer();
    };
  }, []);

  if (state !== 'show') return null;
  return (
    <div
      className={`pointer-events-none fixed z-20 flex justify-center px-4 ${mobile ? 'inset-x-0 bottom-[208px]' : 'right-0 bottom-7 left-[424px]'}`}
    >
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-fg-2 animate-rise">
        <Icon name="sparkles" size={16} className="text-accent" />
        {mobile ? t.hintTouch : t.hint}
      </div>
    </div>
  );
}
