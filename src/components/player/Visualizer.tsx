'use client';

import { useEffect, useRef } from 'react';
import { engine } from '@/lib/audio/engine';
import { usePlayer } from '@/store/player';

type Variant = 'bars' | 'ring';

/**
 * Spectrum visualiser. Uses real FFT data when the stream allows analysis (CORS),
 * otherwise draws a calm synthetic "breathing" spectrum so the UI still feels alive.
 */
export function Visualizer({ variant, className = '', bars = variant === 'ring' ? 96 : 56 }: { variant: Variant; className?: string; bars?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let running = false;
    const levels = new Float32Array(bars);
    const peaks = new Float32Array(bars);
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
            0.16 +
            0.13 * Math.sin(t * 0.0021 + x * 9) * Math.sin(t * 0.0013 + x * 3.7) +
            0.08 * Math.sin(t * 0.0047 + x * 21) +
            0.12 * Math.exp(-x * 3) * (0.6 + 0.4 * Math.sin(t * 0.006));
          target = Math.max(0.03, target);
        } else {
          target = 0.02;
        }
        levels[k] += (target - levels[k]) * (target > levels[k] ? 0.55 : 0.12);
        peaks[k] = Math.max(levels[k], peaks[k] - 0.006);
      }
    };

    const drawBars = () => {
      ctx.clearRect(0, 0, w, h);
      const gap = 2;
      const bw = Math.max(1.5, (w - gap * (bars - 1)) / bars);
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, 'rgba(255, 122, 61, 0.9)');
      grad.addColorStop(0.55, 'rgba(255, 181, 71, 0.85)');
      grad.addColorStop(1, 'rgba(255, 230, 180, 0.9)');
      ctx.fillStyle = grad;
      for (let k = 0; k < bars; k++) {
        const bh = Math.max(2, levels[k] * h);
        const x = k * (bw + gap);
        ctx.beginPath();
        ctx.roundRect(x, h - bh, bw, bh, Math.min(2, bw / 2));
        ctx.fill();
      }
    };

    const drawRing = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.335;
      const maxLen = Math.min(w, h) * 0.15;
      let energy = 0;
      for (let k = 0; k < bars; k++) energy += levels[k];
      energy /= bars;

      // Soft glow that breathes with the music.
      const glow = ctx.createRadialGradient(cx, cy, r0 * 0.6, cx, cy, r0 + maxLen * 1.6);
      glow.addColorStop(0, `rgba(255, 150, 60, ${0.1 + energy * 0.45})`);
      glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.6, (2 * Math.PI * r0) / bars / 2.4);
      for (let k = 0; k < bars; k++) {
        // Mirror the spectrum so the ring is symmetric left/right.
        const half = k < bars / 2 ? k : bars - 1 - k;
        const v = levels[Math.min(bars - 1, half * 2)];
        const angle = (k / bars) * Math.PI * 2 - Math.PI / 2;
        const len = 2 + v * maxLen;
        const x1 = cx + Math.cos(angle) * (r0 + 4);
        const y1 = cy + Math.sin(angle) * (r0 + 4);
        const x2 = cx + Math.cos(angle) * (r0 + 4 + len);
        const y2 = cy + Math.sin(angle) * (r0 + 4 + len);
        ctx.strokeStyle = `rgba(255, ${Math.round(170 + v * 70)}, ${Math.round(80 + v * 110)}, ${0.35 + v * 0.65})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    const loop = (t: number) => {
      sample(t);
      if (variant === 'ring') drawRing();
      else drawBars();
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
    };
  }, [variant, bars]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
