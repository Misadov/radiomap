'use client';

import { useMemo, useState } from 'react';
import { GENRES, genreLabel } from '@/lib/genres';
import { renderCard, shareCard } from '@/lib/share-card';
import { useUI } from '@/store/ui';
import { Spinner } from '../ui/Eq';
import { playRandom } from '@/lib/actions';
import { countryName, formatNumber, useLang, useT } from '@/lib/i18n';
import { ACHIEVEMENTS, levelOf, levelTitle, streaks, topOf } from '@/lib/passport';
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
  const [sharing, setSharing] = useState(false);

  const stats = useMemo(() => {
    const topCountry = topOf(passport.countryPlays ?? {}, (n) => n);
    const topPlace = topOf(passport.placePlays ?? {}, (n) => n);
    const topGenre = topOf(passport.genrePlays ?? {}, (n) => n);
    const topStation = topOf(passport.stationPlays ?? {}, (v) => v.n);
    const genre = topGenre ? GENRES.find((g) => g.id === topGenre[0]) : null;
    const hours = Math.floor((passport.listenSec ?? 0) / 3600);
    const minutes = Math.floor(((passport.listenSec ?? 0) % 3600) / 60);
    return {
      topCountry,
      topPlace: topPlace ? ([topPlace[0].split('|')[1] ?? topPlace[0], topPlace[1]] as const) : null,
      topGenre: genre && topGenre ? ([genreLabel(genre, lang), topGenre[1]] as const) : null,
      topStation: topStation ? ([passport.stationPlays[topStation[0]].name, topStation[1]] as const) : null,
      time: hours ? t.hoursMinutes(hours, minutes) : t.minutes(minutes),
      streak: streaks(passport.days ?? []),
      jump: Math.round(passport.bestJumpKm),
    };
  }, [passport, lang, t]);

  const onShare = async () => {
    setSharing(true);
    try {
      const unlocked = ACHIEVEMENTS.filter((a) => passport.achievements[a.id]);
      const highlights: [string, string][] = [];
      if (stats.topCountry) highlights.push([t.statTopCountry, countryName(stats.topCountry[0], lang)]);
      if (stats.topPlace) highlights.push([t.statTopCity, stats.topPlace[0]]);
      if (stats.topGenre) highlights.push([t.statTopGenre, stats.topGenre[0]]);
      if (stats.topStation) highlights.push([t.statTopStation, stats.topStation[0]]);
      highlights.push([t.statTime, stats.time]);
      const blob = await renderCard({
        title: t.passportTitle,
        level,
        levelTitle: levelTitle(level, lang),
        xp: `${formatNumber(passport.xp, lang)} XP`,
        stats: [
          [String(countries.length), t.statCountries],
          [formatNumber(Object.keys(passport.places).length, lang), t.statCities],
          [String(Object.keys(passport.achievements).length), t.achievements],
        ],
        highlights,
        achievements: unlocked.map((a) => a.icon),
        flags: countries,
        footer: window.location.host,
      });
      const text = t.shareText(level, countries.length, Object.keys(passport.places).length);
      const how = await shareCard(blob, text, window.location.origin);
      if (how === 'downloaded') useUI.getState().toast(t.cardSaved);
    } catch {
      useUI.getState().toast(t.shareFailed, 'error');
    } finally {
      setSharing(false);
    }
  };

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
          <div className="min-w-0 flex-1">
            <div className="text-[19px] font-extrabold tracking-tight text-fg">{levelTitle(level, lang)}</div>
            <div className="mt-0.5 font-mono text-[12px] text-accent">{formatNumber(passport.xp, lang)} XP</div>
            <div className="mt-1 text-[11.5px] text-fg-3">{t.xpToNext(toNext)}</div>
          </div>
          <button
            type="button"
            onClick={() => void onShare()}
            disabled={sharing}
            aria-label={t.sharePassport}
            className="tip flex size-10 shrink-0 items-center justify-center self-start rounded-xl bg-white/[0.08] text-fg-2 transition-colors hover:bg-white/[0.14] hover:text-fg"
            data-tip={t.sharePassport}
            data-tip-side="left"
          >
            {sharing ? <Spinner size={16} className="text-accent" /> : <Icon name="share" size={18} />}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [`${countries.length}/${totalCountries}`, t.statCountries],
            [formatNumber(Object.keys(passport.places).length, lang), t.statCities],
            [formatNumber(passport.plays, lang), t.statPlays],
          ].map(([v, label]) => (
            <div key={label} className="rounded-2xl bg-black/25 px-2.5 py-2">
              <div className="text-[17px] font-extrabold text-fg">{v}</div>
              <div className="label-mono mt-0.5 text-[9.5px] leading-tight text-fg-3">{label}</div>
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

      {passport.plays ? (
        <>
          <SectionTitle>{t.statistics}</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-line">
            {(
              [
                stats.topCountry && [
                  t.statTopCountry,
                  <span key="c" className="flex min-w-0 items-center gap-2">
                    <Flag cc={stats.topCountry[0]} size={16} />
                    <span className="truncate">{countryName(stats.topCountry[0], lang)}</span>
                  </span>,
                  t.timesPlayed(stats.topCountry[1]),
                ],
                stats.topPlace && [t.statTopCity, stats.topPlace[0], t.timesPlayed(stats.topPlace[1])],
                stats.topGenre && [t.statTopGenre, stats.topGenre[0], t.timesPlayed(stats.topGenre[1])],
                stats.topStation && [t.statTopStation, stats.topStation[0], t.timesPlayed(stats.topStation[1])],
                [t.statTime, stats.time, null],
                [t.statStreak, t.days(stats.streak.current), t.bestStreak(stats.streak.best)],
                [t.statGenres, String(Object.keys(passport.genres).length), null],
                stats.jump ? [t.statJump, `${formatNumber(stats.jump, lang)} km`, null] : null,
              ].filter(Boolean) as [string, React.ReactNode, string | null][]
            ).map(([label, value, sub]) => (
              <div key={label} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                <span className="w-[42%] shrink-0 text-[12px] leading-tight text-fg-3">{label}</span>
                <span className="min-w-0 flex-1 text-right">
                  <span className="flex min-w-0 justify-end text-[13.5px] font-bold text-fg">
                    <span className="min-w-0 truncate">{value}</span>
                  </span>
                  {sub ? <span className="block font-mono text-[10.5px] text-fg-3">{sub}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

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
