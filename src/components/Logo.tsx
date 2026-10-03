import { useId } from 'react';

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe3a6" />
          <stop offset=".45" stopColor="#ffb547" />
          <stop offset="1" stopColor="#ff7a3d" />
        </linearGradient>
        <radialGradient id={`d${id}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor="#ffe2a8" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="30" cy="34" r="17" fill="none" stroke={`url(#g${id})`} strokeWidth="3.4" />
      <ellipse cx="30" cy="34" rx="7.4" ry="17" fill="none" stroke={`url(#g${id})`} strokeWidth="2.2" opacity=".5" />
      <path d="M13.5 34h33" stroke={`url(#g${id})`} strokeWidth="2.2" opacity=".5" />
      <path
        d="M42.5 15.5a10 10 0 0 1 6 6M44.6 9.6a16.5 16.5 0 0 1 9.8 9.8"
        fill="none"
        stroke={`url(#g${id})`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="39" cy="25" r="9" fill={`url(#d${id})`} />
      <circle cx="39" cy="25" r="2.8" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-[-0.03em] ${className ?? ''}`}>
      Radio<span className="text-gradient">Map</span>
    </span>
  );
}
