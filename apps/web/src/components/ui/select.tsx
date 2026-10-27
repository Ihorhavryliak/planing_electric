import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 shadow-inner shadow-black/20 transition-colors hover:border-white/20 focus:border-[var(--dmp-color-brand)]/60 focus:ring-2 focus:ring-[var(--dmp-color-brand)]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
