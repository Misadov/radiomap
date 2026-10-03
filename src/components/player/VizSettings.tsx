'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useLibrary, type VizColor, type VizMode } from '@/store/library';
import { IconButton } from '../ui/IconButton';
import { VIZ_PALETTES } from './Visualizer';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-black/30 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`h-8 rounded-lg px-1 text-[11.5px] font-semibold transition-colors ${value === v ? 'bg-white/[0.12] text-fg' : 'text-fg-3 hover:text-fg-2'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Popover with visualiser options; `side` is where it opens relative to the button. */
export function VizSettings({ side = 'bottom', size = 'sm' }: { side?: 'top' | 'bottom'; size?: 'sm' | 'md' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const settings = useLibrary((s) => s.settings);
  const set = useLibrary((s) => s.setSettings);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const barModes: [VizMode, string][] = [
    ['bars', t.vizBars],
    ['mirror', t.vizMirror],
    ['wave', t.vizWave],
    ['off', t.vizOff],
  ];
  const fullModes: [VizMode, string][] = [
    ['ring', t.vizRing],
    ['wave', t.vizBlob],
    ['bars', t.vizBars],
    ['off', t.vizOff],
  ];

  return (
    <div ref={ref} className="relative">
      <IconButton icon="sliders" label={t.vizSettings} size={size} tip={open ? false : 'top'} onClick={() => setOpen((v) => !v)} />
      {open ? (
        <div
          className={`absolute right-0 z-50 w-[280px] rounded-2xl border border-line-2 bg-panel-solid/95 p-3 shadow-2xl backdrop-blur-xl animate-fade-in ${
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="label-mono mb-1.5 text-fg-3">{t.vizCompact}</div>
          <Segmented value={settings.vizBar} options={barModes} onChange={(vizBar) => set({ vizBar })} />
          <div className="label-mono mt-3 mb-1.5 text-fg-3">{t.vizFull}</div>
          <Segmented value={settings.vizFull} options={fullModes} onChange={(vizFull) => set({ vizFull })} />
          <div className="label-mono mt-3 mb-1.5 text-fg-3">{t.vizColor}</div>
          <div className="flex gap-2">
            {(Object.keys(VIZ_PALETTES) as VizColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={settings.vizColor === c}
                onClick={() => set({ vizColor: c })}
                className={`h-7 flex-1 rounded-lg transition-transform active:scale-95 ${settings.vizColor === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-[#11131f]' : ''}`}
                style={{ background: `linear-gradient(90deg, ${VIZ_PALETTES[c].join(',')})` }}
              />
            ))}
          </div>
          <div className="label-mono mt-3 mb-1 flex justify-between text-fg-3">
            <span>{t.vizIntensity}</span>
            <span>{Math.round(settings.vizIntensity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.vizIntensity}
            onChange={(e) => set({ vizIntensity: Number(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
      ) : null}
    </div>
  );
}
