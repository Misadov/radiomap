'use client';

import { useEffect, useRef } from 'react';

/** Static star field + nebula glow behind the globe, drawn once per resize. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      let seed = 1337;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const count = Math.round((w * h) / 2600);
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const big = rand() > 0.97;
        const r = big ? 0.9 + rand() * 0.8 : 0.25 + rand() * 0.55;
        const warm = rand() > 0.8;
        const a = big ? 0.55 + rand() * 0.4 : 0.12 + rand() * 0.45;
        ctx.fillStyle = warm ? `rgba(255, 214, 170, ${a})` : `rgba(200, 215, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (big) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
          g.addColorStop(0, `rgba(200, 215, 255, ${a * 0.25})`);
          g.addColorStop(1, 'rgba(200, 215, 255, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
        }
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 60% at 62% 48%, #0d1530 0%, #070b18 45%, #04050a 100%), radial-gradient(40% 30% at 15% 85%, rgba(255,140,60,0.06), transparent 70%)',
        }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-90" />
    </div>
  );
}
