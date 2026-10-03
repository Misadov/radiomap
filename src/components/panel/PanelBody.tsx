'use client';

import { useEffect, useRef } from 'react';
import { formatNumber, useLang, useT } from '@/lib/i18n';
import { useLibrary } from '@/store/library';
import { useUI, type Tab } from '@/store/ui';
import { ScrollContext } from '../station/StationList';
import { Icon, type IconName } from '../ui/Icon';
import { CountryView } from './CountryView';
import { ExploreView } from './ExploreView';
import { FavoritesView, HistoryView } from './LibraryView';
import { PlaceView } from './PlaceView';
import { SearchResults } from './SearchResults';

function Tabs() {
  const t = useT();
  const lang = useLang();
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const favorites = useLibrary((s) => s.favorites.length);
  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: 'explore', label: t.tabExplore, icon: 'compass' },
    { id: 'favorites', label: t.tabFavorites, icon: 'heart', count: favorites },
    { id: 'history', label: t.tabHistory, icon: 'clock' },
  ];
  return (
    <div role="tablist" className="mx-3 mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-[14px] bg-black/25 p-1 ring-1 ring-line">
      {tabs.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(item.id)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-semibold transition-all duration-200 ${
              active ? 'bg-white/[0.09] text-fg shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_6px_16px_-8px_rgba(0,0,0,0.8)]' : 'text-fg-3 hover:text-fg-2'
            }`}
          >
            <Icon name={item.icon} size={15} className={active ? 'text-accent' : ''} />
            <span className="truncate">{item.label}</span>
            {item.count ? <span className="font-mono text-[10.5px] text-fg-3">{formatNumber(item.count, lang)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PanelBody() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const query = useUI((s) => s.query.trim());
  const selection = useUI((s) => s.selection);
  const tab = useUI((s) => s.tab);

  const viewKey = query ? 'search' : selection ? (selection.kind === 'place' ? `p${selection.place}` : `c${selection.cc}`) : tab;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  let content: React.ReactNode;
  if (query) content = <SearchResults />;
  else if (selection?.kind === 'place') content = <PlaceView key={viewKey} place={selection.place} />;
  else if (selection?.kind === 'country') content = <CountryView key={viewKey} cc={selection.cc} />;
  else if (tab === 'favorites') content = <FavoritesView />;
  else if (tab === 'history') content = <HistoryView />;
  else content = <ExploreView />;

  return (
    <>
      {!query && !selection ? <Tabs /> : null}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-gutter:stable]">
        <ScrollContext.Provider value={scrollRef}>
          <div>{content}</div>
        </ScrollContext.Provider>
      </div>
    </>
  );
}
