import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import {
  EDITOR_LAYER_KEYS,
  type EditorLayers,
} from './editor-layers';

interface LayersPanelProps {
  layers: EditorLayers;
  onToggle: (key: keyof EditorLayers) => void;
  onShowAll: () => void;
}

export function LayersPanel({ layers, onToggle, onShowAll }: LayersPanelProps) {
  const { t } = useI18n();
  const hidden = EDITOR_LAYER_KEYS.filter((key) => !layers[key]).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('layers.title')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {EDITOR_LAYER_KEYS.length - hidden}/{EDITOR_LAYER_KEYS.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('layers.hint')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {EDITOR_LAYER_KEYS.map((key) => {
          const visible = layers[key];

          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={visible}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                visible
                  ? 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                  : 'border-white/5 bg-transparent text-slate-500 hover:bg-white/[0.04]'
              }`}
            >
              <span className="truncate">{t(`layers.${key}`)}</span>
              {visible ? (
                <Eye className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {hidden > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={onShowAll}
        >
          {t('layers.showAll')}
        </Button>
      ) : null}
    </section>
  );
}
