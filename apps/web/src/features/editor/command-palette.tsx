import {
  Bell,
  FolderOpen,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/features/i18n/i18n-context';

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  /** Optional visual group rendered as a heading. */
  group?: string;
  /** Icon key used by the workspace palette. */
  icon?: string;
  run: () => void;
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  local: FolderOpen,
  materials: Package,
  estimates: Receipt,
  notifications: Bell,
  settings: Settings,
  theme: Sun,
};

const RECENT_KEY = 'dmp:palette:recent';

interface CommandPaletteProps {
  open: boolean;
  commands: readonly CommandPaletteItem[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return commands;

    return commands.filter((command) =>
      `${command.label} ${command.hint ?? ''} ${command.id}`
        .toLowerCase()
        .includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;

    setQuery('');
    setActive(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (active >= visible.length) {
      setActive(Math.max(0, visible.length - 1));
    }
  }, [active, visible.length]);

  useEffect(() => {
    if (!open) return;

    const selected = listRef.current?.querySelector<HTMLElement>(
      `[data-command-index="${active}"]`,
    );
    selected?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const execute = (command: CommandPaletteItem) => {
    try {
      const recent = JSON.parse(
        window.localStorage.getItem(RECENT_KEY) ?? '[]',
      ) as unknown;
      const ids = Array.isArray(recent)
        ? recent.filter((id): id is string => typeof id === 'string')
        : [];
      window.localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([command.id, ...ids.filter((id) => id !== command.id)].slice(0, 5)),
      );
    } catch {
      // Recent commands are a convenience only.
    }
    onClose();
    command.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.title')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-white/10 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) =>
                  visible.length === 0 ? 0 : (index + 1) % visible.length,
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) =>
                  visible.length === 0
                    ? 0
                    : (index - 1 + visible.length) % visible.length,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const command = visible[active];
                if (command) execute(command);
              }
            }}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.search')}
            className="h-12 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
            Esc
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-500">
            {t('palette.empty')}
          </p>
        ) : (
          <ul ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {visible.map((command, index) => {
              const previous = visible[index - 1];
              const group = command.group;
              const showGroup = group && group !== previous?.group;
              const Icon = command.icon ? ICONS[command.icon] : undefined;

              return (
              <li key={command.id}>
                {showGroup ? (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {group}
                  </p>
                ) : null}
                <button
                  type="button"
                  data-command-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => execute(command)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    index === active
                      ? 'bg-[var(--dmp-color-brand)]/15 text-white'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {Icon ? (
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {command.label}
                    </span>
                    {command.hint ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {command.hint}
                      </span>
                    ) : null}
                  </span>
                  {command.shortcut ? (
                    <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {command.shortcut}
                    </span>
                  ) : null}
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
