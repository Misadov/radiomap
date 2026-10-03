'use client';

// Renders the radio passport as a 1080×1350 PNG card and shares it
// (Web Share with files on phones, download + copied text elsewhere).

export interface CardData {
  title: string;
  level: number;
  levelTitle: string;
  xp: string;
  stats: [string, string][]; // [value, label]
  highlights: [string, string][]; // [label, value]
  achievements: string[]; // emoji icons of unlocked achievements
  flags: string[]; // country codes
  footer: string;
}

const flagEmoji = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

export async function renderCard(d: CardData): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#16233f');
  bg.addColorStop(0.55, '#0c0f1c');
  bg.addColorStop(1, '#2a1a10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Stars.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const glow = ctx.createRadialGradient(W - 120, 120, 0, W - 120, 120, 420);
  glow.addColorStop(0, 'rgba(255,150,60,0.35)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const P = 80;
  ctx.fillStyle = '#ffb547';
  ctx.font = `700 34px ${font}`;
  ctx.fillText('📻  RadioMap', P, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 30px ${font}`;
  ctx.fillText(d.title.toUpperCase(), P, 170);

  // Level ring.
  const cx = P + 110;
  const cy = 330;
  ctx.lineWidth = 22;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.stroke();
  const ring = ctx.createLinearGradient(cx - 100, cy - 100, cx + 100, cy + 100);
  ring.addColorStop(0, '#5ef2d0');
  ring.addColorStop(1, '#ffb547');
  ctx.strokeStyle = ring;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, 100, -Math.PI / 2, Math.PI * 1.25);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `800 84px ${font}`;
  ctx.fillText(String(d.level), cx, cy + 28);
  ctx.textAlign = 'left';
  ctx.font = `800 64px ${font}`;
  ctx.fillText(fit(ctx, d.levelTitle, W - cx - 200), cx + 150, cy - 6);
  ctx.fillStyle = '#ffb547';
  ctx.font = `700 40px ${font}`;
  ctx.fillText(d.xp, cx + 150, cy + 52);

  // Stat tiles.
  const tileW = (W - P * 2 - 40) / 3;
  d.stats.slice(0, 3).forEach(([v, label], i) => {
    const x = P + i * (tileW + 20);
    const y = 490;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, tileW, 150, 28);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 58px ${font}`;
    ctx.fillText(fit(ctx, v, tileW - 50), x + 28, y + 80);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `600 24px ${font}`;
    ctx.fillText(fit(ctx, label.toUpperCase(), tileW - 50), x + 28, y + 122);
  });

  // Highlights.
  let y = 720;
  for (const [label, value] of d.highlights.slice(0, 5)) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `600 28px ${font}`;
    ctx.fillText(label, P, y);
    ctx.fillStyle = '#fff';
    ctx.font = `700 34px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, value, W - P * 2 - 380), W - P, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(P, y + 24, W - P * 2, 2);
    y += 72;
  }

  // Achievements and flags.
  ctx.font = `56px ${font}`;
  ctx.fillText(d.achievements.slice(0, 12).join(' '), P, y + 40);
  ctx.font = `48px ${font}`;
  const flags = d.flags.slice(0, 16).map(flagEmoji).join(' ');
  ctx.fillText(flags + (d.flags.length > 16 ? `  +${d.flags.length - 16}` : ''), P, y + 120);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `600 28px ${font}`;
  ctx.fillText(d.footer, P, H - 70);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

/** Returns 'shared' | 'downloaded'. */
export async function shareCard(blob: Blob, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'radiomap-passport.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text}\n${url}` });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'shared';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  } catch {
    /* clipboard unavailable */
  }
  return 'downloaded';
}
