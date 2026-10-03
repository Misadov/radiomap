import { ImageResponse } from 'next/og';
import manifest from '@/data/manifest.json';
import { LOGO_DATA_URI } from './brand';

export const alt = 'RadioMap — live radio from every corner of the planet';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Deterministic "city lights" scattered over the globe disc, denser in the upper half.
function lights() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out: { x: number; y: number; r: number; a: number }[] = [];
  while (out.length < 170) {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1;
    if (x * x + y * y > 0.88 || (y > 0.2 && rand() > 0.35)) continue;
    const big = rand() > 0.9;
    out.push({ x, y, r: big ? 5 + rand() * 4 : 2 + rand() * 2.5, a: 0.55 + rand() * 0.45 });
  }
  return out;
}

export default function OpengraphImage() {
  const R = 300;
  const cx = 860;
  const cy = 330;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'radial-gradient(circle at 70% 50%, #111a36 0%, #070a15 55%, #04050a 100%)',
          color: '#f5f2ea',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: cx - R,
            top: cy - R,
            width: R * 2,
            height: R * 2,
            borderRadius: R,
            background: 'radial-gradient(circle at 35% 30%, #1d2740 0%, #0d1324 55%, #070a14 100%)',
            boxShadow: '0 0 90px 10px rgba(60, 100, 220, 0.35), inset 12px 0 40px rgba(120, 160, 255, 0.25)',
            display: 'flex',
          }}
        />
        {lights().map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx + l.x * R - l.r,
              top: cy + l.y * R - l.r,
              width: l.r * 2,
              height: l.r * 2,
              borderRadius: l.r,
              background: l.r > 5 ? '#fff4d8' : '#ffc35e',
              opacity: l.a,
              boxShadow: `0 0 ${l.r * 3}px ${l.r}px rgba(255, 150, 60, 0.55)`,
              display: 'flex',
            }}
          />
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 80px', width: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <img src={LOGO_DATA_URI} width={96} height={96} alt="" />
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, letterSpacing: -3 }}>
              <span>Radio</span>
              <span style={{ color: '#ffb547' }}>Map</span>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 40, lineHeight: 1.2, color: 'rgba(245, 242, 234, 0.82)' }}>
            Live radio from every corner of the planet
          </div>
          <div style={{ display: 'flex', marginTop: 30, fontSize: 26, color: '#ffb547', letterSpacing: 1 }}>
            {`${manifest.stations.toLocaleString('en')} stations · ${manifest.countries} countries`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
