import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm shadow-black/10',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pb-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-sm font-semibold text-white', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      className={cn('mt-1 text-xs leading-relaxed text-slate-500', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-3', className)} {...props} />;
}
