import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Shared loading placeholder; respects reduced motion via animation utilities. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-lg bg-white/[0.07] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <Skeleton className={compact ? 'h-24 w-full' : 'h-32 w-full'} />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}
