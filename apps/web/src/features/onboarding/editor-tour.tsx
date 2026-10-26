import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { useOnboarding } from './onboarding-context';

interface TourStep {
  target: string;
  titleKey: string;
  bodyKey: string;
}

const STEPS: readonly TourStep[] = [
  {
    target: '[data-tour="editor-toolbar"]',
    titleKey: 'tour.toolbar.title',
    bodyKey: 'tour.toolbar.body',
  },
  {
    target: '[data-tour="editor-canvas"]',
    titleKey: 'tour.canvas.title',
    bodyKey: 'tour.canvas.body',
  },
  {
    target: '[data-tour="circuits"]',
    titleKey: 'tour.circuits.title',
    bodyKey: 'tour.circuits.body',
  },
  {
    target: '[data-tour="validation"]',
    titleKey: 'tour.validation.title',
    bodyKey: 'tour.validation.body',
  },
  {
    target: '[data-tour="save"]',
    titleKey: 'tour.save.title',
    bodyKey: 'tour.save.body',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 360;
const TOOLTIP_MARGIN = 16;
const SPOTLIGHT_PADDING = 6;

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function measure(target: string): Rect | null {
  const element = document.querySelector(target);
  if (!element) return null;

  const bounds = element.getBoundingClientRect();
  if (bounds.width === 0 && bounds.height === 0) return null;

  return {
    top: Math.max(0, bounds.top - SPOTLIGHT_PADDING),
    left: Math.max(0, bounds.left - SPOTLIGHT_PADDING),
    width: Math.min(window.innerWidth, bounds.width + SPOTLIGHT_PADDING * 2),
    height: Math.min(window.innerHeight, bounds.height + SPOTLIGHT_PADDING * 2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** First-run guided tour for the editor. */
export function EditorTour() {
  const { t } = useI18n();
  const { shouldShowTour, completeTour, skipTour } = useOnboarding();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastStep = index === STEPS.length - 1;
  const step = STEPS[index]!;

  const updateRect = useCallback(() => {
    setRect(measure(step.target));
  }, [step.target]);

  useEffect(() => {
    if (!shouldShowTour) return;

    setIndex(0);
  }, [shouldShowTour]);

  useEffect(() => {
    if (!shouldShowTour) return;

    const element = document.querySelector(step.target);
    element?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });

    const frame = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 320);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [index, shouldShowTour, step.target, updateRect]);

  useEffect(() => {
    if (!shouldShowTour) return;

    cardRef.current?.focus();
  }, [index, shouldShowTour]);

  useEffect(() => {
    if (!shouldShowTour) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTour();
        return;
      }

      if (event.key !== 'Tab') return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = [
        ...card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((item) => item.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shouldShowTour, skipTour]);

  const position = useMemo<CSSProperties>(() => {
    const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - TOOLTIP_MARGIN * 2);
    const estimatedHeight = 240;
    let top: number;
    let left: number;

    if (rect) {
      top =
        rect.top + rect.height + 18 + estimatedHeight <= window.innerHeight
          ? rect.top + rect.height + 18
          : rect.top - estimatedHeight - 18;
      top = clamp(top, TOOLTIP_MARGIN, window.innerHeight - estimatedHeight - TOOLTIP_MARGIN);
      left = clamp(
        rect.left + rect.width / 2 - width / 2,
        TOOLTIP_MARGIN,
        window.innerWidth - width - TOOLTIP_MARGIN,
      );
    } else {
      top = Math.max(
        TOOLTIP_MARGIN,
        Math.round(window.innerHeight / 2 - estimatedHeight / 2),
      );
      left = Math.round(window.innerWidth / 2 - width / 2);
    }

    return { top, left, width };
  }, [rect]);

  if (!shouldShowTour || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-testid="editor-tour"
      className="fixed inset-0 z-[120]"
      role="presentation"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={(event) => event.preventDefault()}
      />
      {rect ? (
        <>
          <div
            className="pointer-events-none fixed inset-x-0 top-0 bg-slate-950/75"
            style={{ height: rect.top }}
          />
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 bg-slate-950/75"
            style={{ top: rect.top + rect.height }}
          />
          <div
            className="pointer-events-none fixed bg-slate-950/75"
            style={{
              top: rect.top,
              left: 0,
              width: rect.left,
              height: rect.height,
            }}
          />
          <div
            className="pointer-events-none fixed bg-slate-950/75"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-xl border-2 border-amber-400/80 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-slate-950/80" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-tour-title"
        aria-describedby="editor-tour-body"
        tabIndex={-1}
        className="fixed max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-amber-400/30 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-black/60 outline-none"
        style={position}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-amber-300">
              {t('tour.progress', { current: index + 1, total: STEPS.length })}
            </p>
            <h2
              id="editor-tour-title"
              className="mt-1.5 text-base font-semibold text-white"
            >
              {t(step.titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={skipTour}
            aria-label={t('tour.close')}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p
          id="editor-tour-body"
          className="mt-2 text-sm leading-relaxed text-slate-300"
        >
          {t(step.bodyKey)}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((item, itemIndex) => (
            <span
              key={item.target}
              className={
                itemIndex === index
                  ? 'h-1.5 w-6 rounded-full bg-amber-400'
                  : itemIndex < index
                    ? 'h-1.5 w-1.5 rounded-full bg-amber-400/50'
                    : 'h-1.5 w-1.5 rounded-full bg-white/15'
              }
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={skipTour}
            className="text-xs text-slate-400 underline-offset-2 transition hover:text-white hover:underline"
          >
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('tour.back')}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                lastStep
                  ? completeTour()
                  : setIndex((current) =>
                      Math.min(STEPS.length - 1, current + 1),
                    )
              }
            >
              {lastStep ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('tour.finish')}
                </>
              ) : (
                <>
                  {t('tour.next')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
