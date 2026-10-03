'use client';

import { useMemo, useRef } from 'react';
import { useT } from '@/lib/i18n';
import { fromSaved, useData } from '@/store/data';
import { parseFavoritesFile, useLibrary } from '@/store/library';
import { useUI } from '@/store/ui';
import { StationList } from '../station/StationList';
import { Icon } from '../ui/Icon';
import { EmptyState } from './ViewHeader';

export function FavoritesView() {
  const t = useT();
  const favorites = useLibrary((s) => s.favorites);
  const version = useData((s) => s.version);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    void version;
    return favorites.map(fromSaved);
  }, [favorites, version]);

  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ app: 'radiomap', version: 2, exported: new Date().toISOString(), favorites }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `radiomap-favorites-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    try {
      const added = useLibrary.getState().addFavorites(parseFavoritesFile(JSON.parse(await file.text())));
      useUI.getState().toast(t.imported(added));
    } catch {
      useUI.getState().toast(t.importFailed, 'error');
    }
  };

  const tools = (
    <div className="flex items-center justify-center gap-1.5">
      <button type="button" onClick={() => fileRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-fg-3 hover:bg-elev hover:text-fg">
        <Icon name="upload" size={15} />
        {t.importFavorites}
      </button>
      {favorites.length ? (
        <button type="button" onClick={exportFile} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-fg-3 hover:bg-elev hover:text-fg">
          <Icon name="download" size={15} />
          {t.exportFavorites}
        </button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );

  if (!favorites.length) {
    return (
      <EmptyState icon={<Icon name="heart" size={24} />} title={t.favoritesEmptyTitle} text={t.favoritesEmptyText}>
        <div className="mt-4">{tools}</div>
      </EmptyState>
    );
  }

  return (
    <div className="animate-fade-in pt-1 pb-6">
      <StationList items={items} />
      <div className="mt-3">{tools}</div>
    </div>
  );
}

export function HistoryView() {
  const t = useT();
  const recents = useLibrary((s) => s.recents);
  const version = useData((s) => s.version);
  const items = useMemo(() => {
    void version;
    return recents.map((r) => fromSaved(r.station));
  }, [recents, version]);

  if (!recents.length) {
    return <EmptyState icon={<Icon name="clock" size={24} />} title={t.historyEmptyTitle} text={t.historyEmptyText} />;
  }
  return (
    <div className="animate-fade-in pt-1 pb-6">
      <StationList items={items} />
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => useLibrary.getState().clearRecents()}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-fg-3 hover:bg-elev hover:text-fg"
        >
          <Icon name="trash" size={15} />
          {t.clearHistory}
        </button>
      </div>
    </div>
  );
}
