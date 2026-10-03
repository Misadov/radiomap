'use client';

import { LANGS, useLang, useT } from '@/lib/i18n';
import { useLibrary } from '@/store/library';
import { useUI } from '@/store/ui';
import { LogoMark, Wordmark } from '../Logo';
import { IconButton } from '../ui/IconButton';
import { PanelBody } from './PanelBody';
import { SearchBar } from './SearchBar';

export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const next = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
  return (
    <button
      type="button"
      onClick={() => useLibrary.getState().setLang(next)}
      aria-label={t.language}
      data-tip={t.language}
      data-tip-side="bottom"
      className={`tip relative flex h-8 items-center gap-1 rounded-[10px] px-2 font-mono text-[11.5px] font-semibold tracking-wider text-fg-2 uppercase transition-colors hover:bg-elev-2 hover:text-fg ${className}`}
    >
      {lang}
    </button>
  );
}

/** Desktop: the floating panel on the left. */
export function Sidebar() {
  const t = useT();
  return (
    <aside
      data-occludes-map="left"
      className="glass fixed top-3 bottom-3 left-3 z-30 flex w-[384px] flex-col overflow-hidden rounded-[26px] animate-rise lg:w-[400px]"
    >
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => {
            useUI.getState().select(null);
            useUI.getState().setTab('explore');
          }}
          className="flex items-center gap-2.5 rounded-xl"
          aria-label={t.brand}
        >
          <LogoMark size={30} />
          <Wordmark className="text-[19px]" />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <LangSwitch />
          <IconButton icon="info" label={t.about} size="sm" onClick={() => useUI.getState().setAboutOpen(true)} />
        </div>
      </div>
      <div className="px-3 pb-3">
        <SearchBar />
      </div>
      <PanelBody />
    </aside>
  );
}
