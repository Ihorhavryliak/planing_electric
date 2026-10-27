import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/20 transition-colors placeholder:text-slate-500 focus:border-[var(--dmp-color-brand)]/60 focus:ring-2 focus:ring-[var(--dmp-color-brand)]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
