/** Animated equaliser bars for the station on air. */
export function Eq({ paused = false, className = '' }: { paused?: boolean; className?: string }) {
  return (
    <span className={`eq ${paused ? 'paused' : ''} ${className}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
