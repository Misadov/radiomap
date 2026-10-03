'use client';

import { useEffect } from 'react';
import manifest from '@/data/manifest.json';
import { formatNumber, useLang, useT } from '@/lib/i18n';
import { useUI } from '@/store/ui';
import { LogoMark, Wordmark } from './Logo';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/IconButton';

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <kbd key={k} className="flex h-6 min-w-6 items-center justify-center rounded-md border border-line-2 bg-elev px-1.5 font-mono text-[11px] text-fg-2">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function AboutDialog() {
  const t = useT();
  const lang = useLang();
  const open = useUI((s) => s.aboutOpen);
  const close = () => useUI.getState().setAboutOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const date = new Date(manifest.generated).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  const shortcuts: [string[], string][] = [
    [['Space'], t.kbPlayPause],
    [['/'], t.kbSearch],
    [['N', 'P'], t.kbNextPrev],
    [['R'], t.kbRandom],
    [['F'], t.kbFavorite],
    [['M'], t.kbMute],
    [['↑', '↓'], t.kbVolume],
    [['Esc'], t.kbClose],
    [['?'], t.kbHelp],
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm animate-fade-in md:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.aboutTitle}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-[28px] p-6 animate-pop"
      >
        <IconButton icon="x" label={t.close} size="sm" tip={false} className="absolute top-4 right-4" onClick={close} />
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <Wordmark className="text-[24px]" />
            <p className="text-[12.5px] text-fg-3">{t.tagline}</p>
          </div>
        </div>
        <p className="mt-5 text-[14px] leading-relaxed text-fg-2">{t.aboutText}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [formatNumber(manifest.stations, lang), t.sectionStations],
            [formatNumber(manifest.places, lang), t.sectionPlaces],
            [formatNumber(manifest.countries, lang), t.sectionCountries],
          ].map(([n, label]) => (
            <div key={label} className="rounded-2xl bg-elev px-3 py-3">
              <div className="text-[20px] font-extrabold tracking-tight text-gradient">{n}</div>
              <div className="label-mono mt-0.5 text-fg-3">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-fg-3">{t.aboutData}</p>
        <p className="mt-2 text-[12.5px] text-fg-3">{t.dataUpdated(date)}</p>

        <div className="mt-5 hidden md:block">
          <div className="label-mono mb-2 text-fg-3">{t.shortcuts}</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            {shortcuts.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-[13px] text-fg-2">
                <span className="truncate">{label}</span>
                <Keys keys={keys} />
              </div>
            ))}
          </div>
        </div>

        <a
          href="https://github.com/misadov/radiomap"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-elev px-4 text-[13px] font-semibold text-fg hover:bg-elev-2"
        >
          <Icon name="external" size={16} />
          {t.sourceCode}
        </a>
      </div>
    </div>
  );
}
