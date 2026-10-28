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
        'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] hover:border-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
