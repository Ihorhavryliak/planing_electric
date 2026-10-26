import { useEffect, useRef, useState } from 'react';

interface TooltipState {
  label: string;
  hint?: string;
  x: number;
  y: number;
  below: boolean;
}

interface TitleBackup {
  element: HTMLElement;
  title: string;
}

const SHOW_DELAY_MS = 280;

function tooltipElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;

  const element = target.closest<HTMLElement>(
    'button[aria-label],button[title],[data-tooltip]',
  );

  if (!element || !element.closest('[data-editor-tooltips]')) return null;
  if (element.closest('[data-no-tooltip]')) return null;

  return element;
}

function tooltipText(element: HTMLElement): { label: string; hint?: string } | null {
  const label =
    element.dataset.tooltip ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    '';

  if (!label) return null;

  // Text buttons already explain themselves; only styled icon buttons and
  // explicit data-tooltip elements get a floating hint.
  const visibleText = (element.textContent ?? '').trim();
  if (!element.dataset.tooltip && visibleText.length > 2) return null;

  return {
    label,
    hint: element.dataset.tooltipHint || undefined,
  };
}

/**
 * Floating, styled tooltip layer for editor icon buttons. It uses the existing
 * `aria-label` / `title` text, temporarily removes the native title to avoid
 * a second browser tooltip, and supports an optional longer
 * `data-tooltip-hint` explanation.
 */
export function EditorTooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | null>(null);
  const titleBackupRef = useRef<TitleBackup | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const restoreTitle = () => {
      const backup = titleBackupRef.current;
      titleBackupRef.current = null;

      if (backup && !backup.element.hasAttribute('title')) {
        backup.element.setAttribute('title', backup.title);
      }
    };

    const hide = () => {
      clearTimer();
      restoreTitle();
      setTooltip(null);
    };

    const showFor = (element: HTMLElement) => {
      clearTimer();
      const text = tooltipText(element);

      if (!text) {
        hide();
        return;
      }

      timerRef.current = window.setTimeout(() => {
        const title = element.getAttribute('title');

        if (title) {
          titleBackupRef.current = { element, title };
          element.removeAttribute('title');
        }

        const rect = element.getBoundingClientRect();
        const below = rect.top < 88;

        setTooltip({
          label: text.label,
          hint: text.hint,
          x: rect.left + rect.width / 2,
          y: below ? rect.bottom + 8 : rect.top - 8,
          below,
        });
      }, SHOW_DELAY_MS);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const element = tooltipElement(event.target);
      if (element) showFor(element);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const element = tooltipElement(event.target);
      if (!element) return;
      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;
      hide();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const element = tooltipElement(event.target);
      if (element) showFor(element);
    };

    const handleFocusOut = (event: FocusEvent) => {
      const element = tooltipElement(event.target);
      if (element) hide();
    };

    window.addEventListener('pointerover', handlePointerOver);
    window.addEventListener('pointerout', handlePointerOut);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    window.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', hide);

    return () => {
      clearTimer();
      restoreTitle();
      window.removeEventListener('pointerover', handlePointerOver);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', hide);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-64 rounded-xl border border-white/15 bg-slate-950/95 px-3 py-2 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: tooltip.below
          ? 'translate(-50%, 0)'
          : 'translate(-50%, -100%)',
      }}
    >
      <p className="text-[11px] font-semibold leading-snug">{tooltip.label}</p>
      {tooltip.hint ? (
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
          {tooltip.hint}
        </p>
      ) : null}
    </div>
  );
}
