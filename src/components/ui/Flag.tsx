/* eslint-disable @next/next/no-img-element -- static SVG flags from /public */
export function Flag({ cc, size = 16, className = '' }: { cc: string; size?: number; className?: string }) {
  if (!cc || cc.length !== 2) return null;
  return (
    <img
      src={`/vendor/flags/${cc.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      loading="lazy"
      className={`inline-block shrink-0 rounded-[2.5px] object-cover shadow-[0_0_0_0.5px_rgba(255,255,255,0.18)] ${className}`}
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  );
}
