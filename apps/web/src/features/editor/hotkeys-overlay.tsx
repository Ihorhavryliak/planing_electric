import { X } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';

interface HotkeysOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface HotkeyRow {
  keys: string[];
  label: string;
}

interface HotkeyGroup {
  title: string;
  rows: HotkeyRow[];
}

export function HotkeysOverlay({ open, onClose }: HotkeysOverlayProps) {
  const { t } = useI18n();

  if (!open) return null;

  const groups: HotkeyGroup[] = [
    {
      title: t('hotkeys.tools'),
      rows: [
        { keys: ['V'], label: t('hotkeys.select') },
        { keys: ['H'], label: t('hotkeys.pan') },
        { keys: ['C'], label: t('hotkeys.calibrate') },
        { keys: ['R'], label: t('hotkeys.route') },
        { keys: ['Q'], label: t('hotkeys.wall') },
        { keys: ['O'], label: t('hotkeys.room') },
        { keys: ['D'], label: t('hotkeys.dimension') },
      ],
    },
    {
      title: t('hotkeys.points'),
      rows: [
        { keys: ['S'], label: t('editor.point.socket') },
        { keys: ['W'], label: t('editor.point.switch') },
        { keys: ['L'], label: t('editor.point.light') },
        { keys: ['B'], label: t('editor.point.panel') },
        { keys: ['J'], label: t('editor.point.junction') },
      ],
    },
    {
      title: t('hotkeys.canvas'),
      rows: [
        { keys: ['G'], label: t('hotkeys.snap') },
        { keys: ['Space'], label: t('hotkeys.panHold') },
        { keys: ['0'], label: t('hotkeys.fit') },
        { keys: ['1'], label: t('hotkeys.zoomReset') },
        { keys: ['+', '−'], label: t('hotkeys.zoom') },
        { keys: ['Del'], label: t('hotkeys.delete') },
        { keys: ['Enter'], label: t('hotkeys.finish') },
        { keys: ['Esc'], label: t('hotkeys.cancel') },
      ],
    },
    {
      title: t('hotkeys.application'),
      rows: [
        { keys: ['Ctrl', 'Z'], label: t('hotkeys.undo') },
        { keys: ['Ctrl', 'Shift', 'Z'], label: t('hotkeys.redo') },
        { keys: ['Ctrl', 'K'], label: t('hotkeys.palette') },
        { keys: ['F11', 'Shift', 'F'], label: t('hotkeys.fullscreen') },
        { keys: ['?'], label: t('hotkeys.help') },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('hotkeys.title')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {t('hotkeys.title')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t('hotkeys.hint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('hotkeys.close')}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {group.rows.map((row) => (
                  <li
                    key={`${group.title}-${row.label}`}
                    className="flex items-center justify-between gap-3 text-xs text-slate-300"
                  >
                    <span>{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-slate-400"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
