import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/** Accessible hover/focus tooltip; the label is mirrored to aria-label. */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: TooltipProps) {
  return (
    <span
      className="group relative inline-flex"
      aria-label={label}
      data-tooltip={label}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[10px] whitespace-nowrap text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
