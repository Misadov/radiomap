import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'ghost' | 'glass' | 'accent' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, string> = {
  sm: 'size-8 rounded-[10px]',
  md: 'size-10 rounded-xl',
  lg: 'size-11 rounded-[14px]',
};

const variants: Record<Variant, string> = {
  ghost: 'text-fg-2 hover:text-fg hover:bg-elev-2 active:bg-elev',
  soft: 'text-fg-2 bg-elev hover:text-fg hover:bg-elev-2',
  glass: 'glass text-fg-2 hover:text-fg',
  accent: 'accent-gradient text-[#1b1206] shadow-[0_8px_28px_-10px_rgba(255,140,60,0.8)] hover:brightness-110',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  iconSize,
  tip = 'bottom',
  active,
  className = '',
  children,
  ...rest
}: {
  icon: IconName;
  label: string;
  variant?: Variant;
  size?: Size;
  iconSize?: number;
  tip?: 'top' | 'bottom' | 'left' | 'right' | false;
  active?: boolean;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={tip ? label : undefined}
      data-tip-side={tip || undefined}
      className={`tip relative inline-flex shrink-0 items-center justify-center transition-[color,background-color,transform,filter] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${active ? '!text-accent' : ''} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? (size === 'sm' ? 17 : size === 'md' ? 19 : 21)} />
      {children}
    </button>
  );
}
