import type { SVGProps } from 'react';

// A small, consistent icon set (24px grid, 1.8 stroke) — no icon font, no runtime cost.

const paths = {
  play: <path d="M7 4.8v14.4a1 1 0 0 0 1.52.85l11.5-7.2a1 1 0 0 0 0-1.7L8.52 3.95A1 1 0 0 0 7 4.8Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  next: (
    <>
      <path d="M5 5.6v12.8a.9.9 0 0 0 1.4.75l9.3-6.4a.9.9 0 0 0 0-1.5L6.4 4.85A.9.9 0 0 0 5 5.6Z" fill="currentColor" stroke="none" />
      <rect x="17" y="5" width="2.4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M19 5.6v12.8a.9.9 0 0 1-1.4.75l-9.3-6.4a.9.9 0 0 1 0-1.5l9.3-6.4A.9.9 0 0 1 19 5.6Z" fill="currentColor" stroke="none" />
      <rect x="4.6" y="5" width="2.4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  heart: <path d="M12 20.3s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.7c0 5.8-7.8 10.4-7.8 10.4Z" />,
  heartFill: <path d="M12 20.3s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.7c0 5.8-7.8 10.4-7.8 10.4Z" fill="currentColor" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronDown: <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  chevronUp: <path d="m5.5 14.5 6.5-6.5 6.5 6.5" />,
  shuffle: (
    <>
      <path d="M3.5 7h2.6c2.3 0 3.6 1 5 3.2l1.8 3.6c1.4 2.2 2.7 3.2 5 3.2h2.6" />
      <path d="M3.5 17h2.6c1.6 0 2.7-.5 3.7-1.5M14.3 8.5c1-1 2.1-1.5 3.7-1.5h2.5" />
      <path d="m17.8 4.2 2.8 2.8-2.8 2.8M17.8 14.2l2.8 2.8-2.8 2.8" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.4 12h17.2M12 3.2c2.4 2.4 3.6 5.3 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.3-3.6-8.8s1.2-6.4 3.6-8.8Z" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5v5h3.3L12 18.6V5.4L7.3 9.5H4Z" fill="currentColor" stroke="none" />
      <path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.3a8 8 0 0 1 0 11.4" />
    </>
  ),
  volumeLow: (
    <>
      <path d="M4 9.5v5h3.3L12 18.6V5.4L7.3 9.5H4Z" fill="currentColor" stroke="none" />
      <path d="M15.6 9a4.2 4.2 0 0 1 0 6" />
    </>
  ),
  volumeMute: (
    <>
      <path d="M4 9.5v5h3.3L12 18.6V5.4L7.3 9.5H4Z" fill="currentColor" stroke="none" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  share: (
    <>
      <path d="M12 3.8v11.4M7.6 8.2 12 3.8l4.4 4.4" />
      <path d="M5 12.5v5.3A2.2 2.2 0 0 0 7.2 20h9.6a2.2 2.2 0 0 0 2.2-2.2v-5.3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
      <path d="M18 14.5v3.3a1.7 1.7 0 0 1-1.7 1.7H6.2a1.7 1.7 0 0 1-1.7-1.7V7.7A1.7 1.7 0 0 1 6.2 6h3.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z" fill="currentColor" fillOpacity=".18" />
    </>
  ),
  radio: (
    <>
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.8" y="6" width="18.4" height="12" rx="2.2" />
      <path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M7.5 14.5h9" />
    </>
  ),
  download: <path d="M12 4v11.5M7.6 11.2 12 15.6l4.4-4.4M5 19.5h14" />,
  upload: <path d="M12 15.5V4M7.6 8.4 12 4l4.4 4.4M5 19.5h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M10.3 4.2 2.9 17.6A2 2 0 0 0 4.6 20.6h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  expand: <path d="m6 15 6-6 6 6" />,
  pin: (
    <>
      <path d="M12 21s-6.8-5.7-6.8-11.2a6.8 6.8 0 0 1 13.6 0C18.8 15.3 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2A1.5 1.5 0 0 0 8.9 20.6h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />,
  music: (
    <>
      <path d="M9 17.5V6l10.5-2v11.5" />
      <circle cx="6.8" cy="17.5" r="2.4" />
      <circle cx="17.2" cy="15.5" r="2.4" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9 12 3.5Z" fill="currentColor" fillOpacity=".15" />
      <path d="M18.5 15.5 19.2 17.8 21.5 18.5 19.2 19.2 18.5 21.5 17.8 19.2 15.5 18.5 17.8 17.8Z" />
    </>
  ),
  languages: (
    <>
      <path d="M4 5.5h8M8 3.5v2M10.5 5.5c-.8 3.6-3 6.4-6.2 8M6 8.6c1 2 2.8 3.6 4.9 4.6" />
      <path d="m12.5 20.5 4-9.5 4 9.5M14 17h5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
