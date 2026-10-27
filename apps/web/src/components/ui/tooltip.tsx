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
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
