'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { useUI } from '@/store/ui';
import { IconButton } from '../ui/IconButton';

/** Sticky top bar of drill-down views (place, country). */
export function ViewHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  const t = useT();
  return (
    <div className="sticky top-0 z-20 -mx-3 mb-1 flex items-center gap-1.5 bg-gradient-to-b from-panel-solid via-panel-solid/95 to-panel-solid/0 px-1.5 pt-1.5 pb-3">
      <IconButton icon="chevronLeft" label={t.back} onClick={() => useUI.getState().back()} tip="right" />
      <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg-2">{title}</div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-5 mb-2 flex items-center justify-between gap-3 px-1">
      <h3 className="label-mono text-fg-3">{children}</h3>
      {aside}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center animate-fade-in">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-elev text-fg-3">{icon}</div>
      <div className="text-[15px] font-semibold text-fg">{title}</div>
      {text ? <p className="mt-1.5 max-w-64 text-[13px] leading-relaxed text-fg-3">{text}</p> : null}
      {children}
    </div>
  );
}
