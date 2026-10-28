import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-secondary text-muted-foreground',
        brand: 'border-primary/25 bg-primary/10 text-primary',
        success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400',
        warning: 'border-amber-400/25 bg-amber-400/10 text-amber-400',
        danger: 'border-rose-400/25 bg-rose-400/10 text-rose-400',
        info: 'border-sky-400/25 bg-sky-400/10 text-sky-400',
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
