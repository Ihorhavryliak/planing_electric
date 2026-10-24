import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 shadow-inner shadow-black/20 transition-colors placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
