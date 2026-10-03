'use client';

import { memo, useState } from 'react';
import { hueOf, initials } from '@/lib/text';

const failed = new Set<string>();

/** Station logo, or a generated gradient tile with initials when there is none (or it fails). */
export const Artwork = memo(function Artwork({
  src,
  name,
  size = 44,
  radius = 12,
  className = '',
}: {
  src: string;
  name: string;
  size?: number;
  radius?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(() => !src || failed.has(src));
  const [loaded, setLoaded] = useState(false);
  const hue = hueOf(name);
  const showImage = !broken && !!src;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: showImage && loaded
          ? 'rgb(240 236 228)'
          : `linear-gradient(135deg, hsl(${hue} 55% 34%), hsl(${(hue + 50) % 360} 65% 16%))`,
      }}
    >
      {!showImage || !loaded ? (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-white/85 select-none"
          style={{ fontSize: Math.max(10, size * 0.34), letterSpacing: '-0.02em' }}
        >
          {initials(name)}
        </span>
      ) : null}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party logos
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={(e) => {
            // 1×1 tracking pixels and broken "logos" count as missing.
            if (e.currentTarget.naturalWidth < 8) {
              failed.add(src);
              setBroken(true);
            } else setLoaded(true);
          }}
          onError={() => {
            failed.add(src);
            setBroken(true);
          }}
          className={`absolute inset-0 h-full w-full object-contain p-[7%] transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/10 ring-inset" />
    </div>
  );
});
