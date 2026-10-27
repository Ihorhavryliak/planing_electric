import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      variant: {
        neutral: 'border-white/10 bg-white/5 text-slate-300',
        brand:
          'border-[var(--dmp-color-brand)]/25 bg-[var(--dmp-color-brand)]/10 text-[var(--dmp-color-brand)]',
        success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
        warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
        danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
        info: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
