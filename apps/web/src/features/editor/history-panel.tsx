import { Eye, EyeOff, History, Redo2, Undo2 } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';
import type { HistoryCommand } from './editor-history';

interface HistoryPanelProps {
  past: readonly HistoryCommand[];
  future: readonly HistoryCommand[];
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onJump: (target: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface HistoryRow {
  key: string;
  label: string;
  target: number;
  tone: 'past' | 'current' | 'future';
}

export function HistoryPanel({
  past,
  future,
  open,
  busy,
  onToggle,
  onJump,
  onUndo,
  onRedo,
}: HistoryPanelProps) {
  const { t } = useI18n();
  const rows: HistoryRow[] = [];

  for (let index = past.length - 1; index >= 0; index -= 1) {
    const command = past[index];
    if (!command) continue;
    rows.push({
      key: `past-${index}`,
      label: command.label,
      target: index + 1,
      tone: index === past.length - 1 ? 'current' : 'past',
    });
  }

  future.forEach((command, index) => {
    rows.push({
      key: `future-${index}`,
      label: command.label,
      target: past.length + index + 1,
      tone: 'future',
    });
  });

  return (
    <section className="editor-panel p-3" data-testid="editor-history">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <History className="h-4 w-4 text-slate-400" />
          {t('editor.historyPanel.title')}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t('editor.historyPanel.undo')}
            title={t('editor.historyPanel.undo')}
            disabled={busy || past.length === 0}
            onClick={onUndo}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={t('editor.historyPanel.redo')}
            title={t('editor.historyPanel.redo')}
            disabled={busy || future.length === 0}
            onClick={onRedo}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={
              open
                ? t('editor.historyPanel.hide')
                : t('editor.historyPanel.show')
            }
            title={
              open
                ? t('editor.historyPanel.hide')
                : t('editor.historyPanel.show')
            }
            aria-pressed={open}
            onClick={onToggle}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white/10 ${
              open ? 'text-[var(--dmp-color-brand)]' : 'text-slate-500'
            }`}
          >
            {open ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-2 space-y-0.5">
          {rows.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-500">
              {t('editor.historyPanel.empty')}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto pr-0.5">
              {rows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  disabled={busy || row.tone === 'current'}
                  onClick={() => onJump(row.target)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition ${
                    row.tone === 'current'
                      ? 'bg-[var(--dmp-color-brand)]/12 text-[var(--dmp-color-brand)]'
                      : row.tone === 'future'
                        ? 'text-slate-500 hover:bg-white/5'
                        : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      row.tone === 'current'
                        ? 'bg-[var(--dmp-color-brand)]'
                        : row.tone === 'future'
                          ? 'border border-slate-600'
                          : 'bg-slate-500'
                    }`}
                  />
                  <span className="truncate">{row.label}</span>
                  {row.tone === 'current' ? (
                    <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide opacity-70">
                      {t('editor.historyPanel.current')}
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || past.length === 0}
                onClick={() => onJump(0)}
                className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-slate-500 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full border border-slate-600"
                />
                {t('editor.historyPanel.start')}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
