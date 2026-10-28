import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
}

/** Lightweight details/summary popover; closes on outside click via native details. */
export function Popover({
  trigger,
  children,
  className,
  align = 'start',
}: PopoverProps) {
  return (
    <details className="group relative inline-block">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div
        className={cn(
          'absolute z-40 mt-2 min-w-48 rounded-lg border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg',
          align === 'end' ? 'right-0' : 'left-0',
          className,
        )}
      >
        {children}
      </div>
    </details>
  );
}
