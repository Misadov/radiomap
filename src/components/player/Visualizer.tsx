'use client';

import { useEffect, useRef } from 'react';
import { engine } from '@/lib/audio/engine';
import { useLibrary, type VizColor } from '@/store/library';
import { usePlayer } from '@/store/player';

type Slot = 'bar' | 'full';

/** Gradient stops, bottom → top (or inner → outer). */
export const VIZ_PALETTES: Record<VizColor, [string, string, string]> = {
  sunset: ['#ff7a3d', '#ffb547', '#ffe6b4'],
  aurora: ['#2fb6ff', '#5ef2d0', '#d8ffb0'],
  neon: ['#ff3dbb', '#a35cff', '#4de1ff'],
  ice: ['#5a7dff', '#9fc4ff', '#ffffff'],
  mono: ['#8e95b0', '#d3d7e6', '#ffffff'],
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

/**
 * Spectrum visualiser. Uses real FFT data when the stream allows analysis (CORS),
 * otherwise draws a calm synthetic "breathing" spectrum so the UI still feels alive.
 * Look and feel come from the user's settings (mode, palette, intensity).
 */
export function Visualizer({ slot, className = '' }: { slot: Slot; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useLibrary((s) => (slot === 'bar' ? s.settings.vizBar : s.settings.vizFull));
  const color = useLibrary((s) => s.settings.vizColor);
  const intensity = useLibrary((s) => s.settings.vizIntensity);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode === 'off') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = slot === 'bar' ? (mode === 'mirror' ? 48 : 64) : mode === 'bars' ? 40 : 96;
    const palette = VIZ_PALETTES[color];
    const rgb = palette.map(hexToRgb);
    let frame = 0;
    let running = false;
    const levels = new Float32Array(bars);
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Log-spaced bins: more resolution in the bass where music lives.
    const binFor = (k: number, binCount: number) => {
      const min = 2;
      const max = Math.min(binCount - 1, Math.floor(binCount * 0.72));
      return Math.floor(min * Math.pow(max / min, k / bars));
    };

    const sample = (t: number) => {
      const { status } = usePlayer.getState();
      const freq = engine.frequencies();
      const active = status === 'playing';
      for (let k = 0; k < bars; k++) {
        let target = 0;
        if (active && freq) {
          const a = binFor(k, freq.length);
          const b = Math.max(a + 1, binFor(k + 1, freq.length));
          let sum = 0;
          for (let i = a; i < b; i++) sum += freq[i];
          const v = sum / (b - a) / 255;
          // Gentle treble lift so the right side doesn't look dead.
          target = Math.pow(v, 1.35) * (0.85 + (k / bars) * 0.45);
        } else if (active) {
          const x = k / bars;
          target =
            0.22 +
            0.16 * Math.sin(t * 0.0021 + x * 9) * Math.sin(t * 0.0013 + x * 3.7) +
            0.1 * Math.sin(t * 0.0047 + x * 21) +
            0.16 * Math.exp(-x * 3) * (0.6 + 0.4 * Math.sin(t * 0.006));
          target = Math.max(0.04, target);
        } else {
          target = 0.02;
        }
        levels[k] += (target - levels[k]) * (target > levels[k] ? 0.55 : 0.12);
      }
    };

    const linear = (y0: number, y1: number) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, palette[0]);
      g.addColorStop(0.55, palette[1]);
      g.addColorStop(1, palette[2]);
      return g;
    };

    /** Bars along the bottom of a band [top, bottom]; mirrored grows both ways from the middle. */
    const drawBars = (top: number, bottom: number, mirrored: boolean) => {
      const band = bottom - top;
      const gap = Math.max(1.5, w / bars / 4.5);
      const bw = Math.max(1.5, (w - gap * (bars - 1)) / bars);
      const mid = top + band / 2;
      ctx.fillStyle = mirrored ? linear(mid, top) : linear(bottom, top);
      for (let k = 0; k < bars; k++) {
        const x = k * (bw + gap);
        if (mirrored) {
          const bh = Math.max(2, levels[k] * band);
          ctx.beginPath();
          ctx.roundRect(x, mid - bh / 2, bw, bh, Math.min(3, bw / 2));
          ctx.fill();
        } else {
          const bh = Math.max(2, levels[k] * band);
          ctx.beginPath();
          ctx.roundRect(x, bottom - bh, bw, bh, Math.min(3, bw / 2));
          ctx.fill();
        }
      }
    };

    /** Smooth filled spectrum curve with a bright edge. */
    const drawWave = (top: number, bottom: number) => {
      const band = bottom - top;
      const pts: [number, number][] = [];
      for (let k = 0; k < bars; k++) pts.push([(k / (bars - 1)) * w, bottom - Math.max(0.02, levels[k]) * band]);
      const path = new Path2D();
      path.moveTo(0, bottom);
      path.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      path.lineTo(w, pts[pts.length - 1][1]);
      path.lineTo(w, bottom);
      path.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = linear(bottom, top);
      ctx.fill(path);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette[2];
      const edge = new Path2D();
      edge.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        edge.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      ctx.stroke(edge);
    };

    const energy = () => {
      let e = 0;
      for (let k = 0; k < bars; k++) e += levels[k];
      return e / bars;
    };

    const glow = (cx: number, cy: number, r0: number, r1: number) => {
      const [r, g, b] = rgb[1];
      const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.1 + energy() * 0.5})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    const mirrorLevel = (k: number) => {
      const half = k < bars / 2 ? k : bars - 1 - k;
      return levels[Math.min(bars - 1, half * 2)];
    };

    const drawRing = () => {
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.335;
      const maxLen = Math.min(w, h) * 0.15;
      glow(cx, cy, r0 * 0.6, r0 + maxLen * 1.6);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.6, (2 * Math.PI * r0) / bars / 2.4);
      for (let k = 0; k < bars; k++) {
        const v = mirrorLevel(k);
        const angle = (k / bars) * Math.PI * 2 - Math.PI / 2;
        const len = 2 + v * maxLen;
        const c = v < 0.5 ? rgb[0].map((a, i) => a + (rgb[1][i] - a) * v * 2) : rgb[1].map((a, i) => a + (rgb[2][i] - a) * (v - 0.5) * 2);
        ctx.strokeStyle = `rgba(${c.map(Math.round).join(',')}, ${0.4 + v * 0.6})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * (r0 + 4), cy + Math.sin(angle) * (r0 + 4));
        ctx.lineTo(cx + Math.cos(angle) * (r0 + 4 + len), cy + Math.sin(angle) * (r0 + 4 + len));
        ctx.stroke();
      }
    };

    /** Liquid blob around the artwork. */
    const drawBlob = () => {
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.34;
      const maxLen = Math.min(w, h) * 0.14;
      glow(cx, cy, r0 * 0.6, r0 + maxLen * 1.8);
      for (const [scale, alpha] of [
        [1, 0.35],
        [0.65, 0.8],
      ] as const) {
        const path = new Path2D();
        for (let k = 0; k <= bars; k++) {
          const v = mirrorLevel(k % bars);
          const angle = (k / bars) * Math.PI * 2 - Math.PI / 2;
          const r = r0 + 3 + v * maxLen * scale;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (k === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        path.closePath();
        const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r0 + maxLen);
        grad.addColorStop(0, palette[0]);
        grad.addColorStop(1, palette[2]);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.fill(path);
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (slot === 'full') {
        if (mode === 'ring') drawRing();
        else if (mode === 'wave') drawBlob();
        else drawBars(h * 0.8, h, mode === 'mirror');
        return;
      }
      if (mode === 'wave') drawWave(h * 0.12, h);
      else drawBars(mode === 'mirror' ? 0 : h * 0.1, h, mode === 'mirror');
    };

    const loop = (t: number) => {
      sample(t);
      draw();
      frame = requestAnimationFrame(loop);
    };

    const sync = () => {
      const { status } = usePlayer.getState();
      const shouldRun = document.visibilityState === 'visible' && (status === 'playing' || status === 'loading' || levels.some((l) => l > 0.03));
      if (shouldRun && !running) {
        running = true;
        frame = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    };
    sync();
    const unsub = usePlayer.subscribe(sync);
    document.addEventListener('visibilitychange', sync);
    // Let the bars fall back down after a pause before stopping the loop.
    const settle = setInterval(sync, 1000);

    return () => {
      cancelAnimationFrame(frame);
      unsub();
      clearInterval(settle);
      document.removeEventListener('visibilitychange', sync);
      ro.disconnect();
      ctx.clearRect(0, 0, w, h);
    };
  }, [slot, mode, color]);

  if (mode === 'off') return null;
  // In the compact bar the spectrum sits behind text: intensity drives its opacity.
  const opacity = slot === 'bar' ? 0.12 + intensity * 0.5 : 0.35 + intensity * 0.65;
  return <canvas ref={canvasRef} className={className} style={{ opacity }} aria-hidden />;
}
