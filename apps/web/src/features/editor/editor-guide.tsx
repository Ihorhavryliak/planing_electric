import {
  ArrowRight,
  BrickWall,
  Cable,
  ChevronDown,
  Download,
  HelpCircle,
  Plug,
  Ruler,
  ShieldCheck,
  SquareDashed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';

interface EditorGuideProps {
  onOpenShortcuts?: () => void;
  onOpenGuide?: () => void;
}

interface EditorGuideOverlayProps {
  open: boolean;
  onClose: () => void;
  onOpenShortcuts?: () => void;
}

const STORAGE_KEY = 'drawmyplace.editor.guide.v1';

function loadOpen(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

interface GuideStep {
  icon: LucideIcon;
  title: string;
  hint: string;
  key?: string;
}

function guideSteps(t: (key: string) => string): GuideStep[] {
  return [
    {
      icon: Ruler,
      title: t('guide.scale'),
      hint: t('guide.scaleHint'),
      key: 'C',
    },
    {
      icon: BrickWall,
      title: t('guide.walls'),
      hint: t('guide.wallsHint'),
      key: 'Q',
    },
    {
      icon: SquareDashed,
      title: t('guide.rooms'),
      hint: t('guide.roomsHint'),
      key: 'O',
    },
    {
      icon: Plug,
      title: t('guide.devices'),
      hint: t('guide.devicesHint'),
    },
    {
      icon: Cable,
      title: t('guide.routes'),
      hint: t('guide.routesHint'),
      key: 'R',
    },
    {
      icon: ShieldCheck,
      title: t('guide.check'),
      hint: t('guide.checkHint'),
    },
  ];
}

function GuideStepCard({
  step,
  index,
  large = false,
}: {
  step: GuideStep;
  index: number;
  large?: boolean;
}) {
  const Icon = step.icon;

  if (large) {
    return (
      <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--dmp-color-brand)]/25 bg-[var(--dmp-color-brand)]/10 text-sm font-semibold text-[var(--dmp-color-brand)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm font-semibold text-white">{step.title}</p>
            {step.key ? (
              <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">
                {step.key}
              </kbd>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            {step.hint}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--dmp-color-brand)]/25 bg-[var(--dmp-color-brand)]/10 text-[10px] font-semibold text-[var(--dmp-color-brand)]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="text-xs font-medium text-slate-200">{step.title}</p>
          {step.key ? (
            <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-slate-400">
              {step.key}
            </kbd>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          {step.hint}
        </p>
      </div>
    </li>
  );
}

export function EditorGuide({
  onOpenShortcuts,
  onOpenGuide,
}: EditorGuideProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(loadOpen);
  const steps = guideSteps(t);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed');
    } catch {
      // Guide state is cosmetic; ignore blocked storage.
    }
  }, [open]);

  return (
    <section
      id="editor-guide"
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dmp-color-brand)]" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">
              {t('guide.title')}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              {t('guide.subtitle')}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t('guide.hide') : t('guide.show')}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open ? (
        <>
          <ol className="mt-3 space-y-2.5">
            {steps.map((step, index) => (
              <GuideStepCard key={step.title} step={step} index={index} />
            ))}
          </ol>

          <div className="mt-3 grid gap-2">
            {onOpenGuide ? (
              <Button size="sm" className="w-full" onClick={onOpenGuide}>
                {t('guide.openFull')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
            {onOpenShortcuts ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onOpenShortcuts}
              >
                <HelpCircle className="h-4 w-4" />
                {t('guide.openShortcuts')}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * Full-screen version of the quick guide. It gives every step enough room for
 * a readable explanation and remains keyboard-dismissible.
 */
export function EditorGuideOverlay({
  open,
  onClose,
  onOpenShortcuts,
}: EditorGuideOverlayProps) {
  const { t } = useI18n();
  const steps = guideSteps(t);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('guide.fullTitle')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--dmp-color-brand)]/25 bg-[var(--dmp-color-brand)]/10">
              <HelpCircle className="h-5 w-5 text-[var(--dmp-color-brand)]" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('guide.fullTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                {t('guide.fullSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('guide.close')}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => (
              <GuideStepCard
                key={step.title}
                step={step}
                index={index}
                large
              />
            ))}
          </ol>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs leading-relaxed text-slate-400">
              {t('guide.footerHint')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={onClose}>
                {t('guide.start')}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {onOpenShortcuts ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenShortcuts}
                >
                  <HelpCircle className="h-4 w-4" />
                  {t('guide.openShortcuts')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small callout used on empty project pages so new users know where to start. */
export function DemoHint() {
  const { t } = useI18n();

  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-400">
      <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--dmp-color-brand)]" />
      {t('guide.demoHint')}
    </p>
  );
}
