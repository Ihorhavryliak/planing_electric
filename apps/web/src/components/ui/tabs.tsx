import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
              active
                ? 'bg-[var(--dmp-color-brand)] text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-white',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
