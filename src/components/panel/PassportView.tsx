'use client';

import { useMemo } from 'react';
import { playRandom } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { ACHIEVEMENTS, levelOf, levelTitle } from '@/lib/passport';
import { useData } from '@/store/data';
import { useLibrary } from '@/store/library';
import { Flag } from '../ui/Flag';
import { Icon } from '../ui/Icon';
import { SectionTitle } from './ViewHeader';

export function PassportView() {
  const t = useT();
  const lang = useLang();
  const passport = useLibrary((s) => s.passport);
  const totalCountries = useData((s) => s.derived?.countries.length ?? 219);
  const { level, progress, toNext } = levelOf(passport.xp);
  const countries = useMemo(
    () => Object.entries(passport.countries).sort((a, b) => b[1] - a[1]).map(([cc]) => cc),
    [passport.countries],
  );
  const share = countries.length / Math.max(1, totalCountries);

  return (
    <div className="animate-fade-in pb-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#1b2a4a]/80 via-[#13182b]/80 to-[#2a1b12]/80 p-4">
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex items-center gap-4">
          <div className="relative size-[76px] shrink-0">
            <svg viewBox="0 0 80 80" className="size-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="url(#xpGrad)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${progress * 213.6} 213.6`}
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.2,.8,.2,1)' }}
              />
              <defs>
                <linearGradient id="xpGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#5ef2d0" />
                  <stop offset="1" stopColor="#ffb547" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] leading-none font-extrabold text-fg">{level}</span>
              <span className="label-mono mt-0.5 text-[8.5px] text-fg-3">LVL</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[19px] font-extrabold tracking-tight text-fg">{levelTitle(level, lang)}</div>
            <div className="mt-0.5 font-mono text-[12px] text-accent">{formatNumber(passport.xp, lang)} XP</div>
            <div className="mt-1 text-[11.5px] text-fg-3">{t.xpToNext(toNext)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [`${countries.length}/${totalCountries}`, t.statCountries],
            [formatNumber(Object.keys(passport.places).length, lang), t.statCities],
            [formatNumber(passport.plays, lang), t.statPlays],
          ].map(([v, label]) => (
            <div key={label} className="rounded-2xl bg-black/25 px-2.5 py-2">
              <div className="text-[17px] font-extrabold text-fg">{v}</div>
              <div className="label-mono mt-0.5 truncate text-[9.5px] text-fg-3">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#5ef2d0] to-[#2fb6ff]" style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
        <button
          type="button"
          onClick={() => void playRandom({ newCountry: true })}
          className="accent-gradient mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold text-[#1b1206] transition-transform active:scale-[0.98]"
        >
          <Icon name="shuffle" size={17} />
          {t.challenge}
        </button>
      </div>

      {!passport.plays ? <p className="mt-4 px-2 text-center text-[13px] leading-relaxed text-fg-3">{t.passportEmpty}</p> : null}

      <SectionTitle aside={<span className="font-mono text-[11px] text-fg-3">{`${Object.keys(passport.achievements).length}/${ACHIEVEMENTS.length}`}</span>}>
        {t.achievements}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const done = !!passport.achievements[a.id];
          const [title, desc] = lang === 'ru' ? a.ru : a.en;
          return (
            <div
              key={a.id}
              className={`flex items-center gap-2.5 rounded-2xl border p-2.5 transition-colors ${done ? 'border-accent/40 bg-accent-soft' : 'border-line opacity-55 grayscale'}`}
            >
              <span className="text-[24px] leading-none">{a.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-bold text-fg">{title}</span>
                <span className="block text-[11px] leading-snug text-fg-3">{desc}</span>
              </span>
            </div>
          );
        })}
      </div>

      {countries.length ? (
        <>
          <SectionTitle>{t.stamps}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((cc) => (
              <span key={cc} title={countryName(cc, lang)} className="rounded-md bg-white/5 p-1 ring-1 ring-line">
                <Flag cc={cc} size={26} />
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
