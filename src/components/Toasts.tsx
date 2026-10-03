'use client';

import { useUI } from '@/store/ui';
import { usePlayer } from '@/store/player';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Icon } from './ui/Icon';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const playing = usePlayer((s) => !!s.station);
  const mobile = useIsMobile();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ bottom: mobile ? 'auto' : playing ? 104 : 24, top: mobile ? 'calc(max(10px, env(safe-area-inset-top)) + 72px)' : 'auto' }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass-strong pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold animate-pop ${toast.tone === 'error' ? 'text-[#ff9a9a]' : 'text-fg'}`}
        >
          <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={16} className={toast.tone === 'error' ? '' : 'text-accent'} />
          {toast.text}
        </div>
      ))}
    </div>
  );
}
