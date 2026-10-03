'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';
import { useUI } from '@/store/ui';
import { Icon } from '../ui/Icon';

export function SearchBar({ onFocus }: { onFocus?: () => void }) {
  const t = useT();
  const query = useUI((s) => s.query);
  const setQuery = useUI((s) => s.setQuery);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => {
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('radiomap:focus-search', focus);
    return () => window.removeEventListener('radiomap:focus-search', focus);
  }, []);

  return (
    <label className="group relative flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-white/[0.045] px-3.5 transition-colors duration-150 focus-within:border-accent/40 focus-within:bg-white/[0.07] hover:border-line-2">
      <Icon name="search" size={19} className="shrink-0 text-fg-3 transition-colors group-focus-within:text-accent" />
      <input
        ref={ref}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (query) setQuery('');
            else e.currentTarget.blur();
          }
        }}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-3 md:text-[14.5px] [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            ref.current?.focus();
          }}
          aria-label={t.clear}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-fg-3 hover:bg-elev-2 hover:text-fg"
        >
          <Icon name="x" size={16} />
        </button>
      ) : (
        <kbd className="hidden h-6 shrink-0 items-center rounded-md border border-line-2 px-1.5 font-mono text-[11px] text-fg-3 md:flex">/</kbd>
      )}
    </label>
  );
}
