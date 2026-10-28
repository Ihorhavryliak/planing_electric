import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Accessible label for the corner close button. */
  closeLabel?: string;
}

/** Token-driven modal with a focus trap, Escape handling and focus restore. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  closeLabel = 'Close dialog',
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimer = window.setTimeout(() => containerRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = containerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const leavingBackwards =
        event.shiftKey &&
        (active === first || active === containerRef.current);
      const leavingForwards = !event.shiftKey && active === last;

      if (leavingBackwards) {
        event.preventDefault();
        last?.focus();
      } else if (leavingForwards) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-[dmp-fade-in_180ms_ease-out]" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none motion-safe:animate-[dmp-scale-in_180ms_ease-out]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-xs leading-relaxed text-muted-foreground"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? (
          <div className="mt-5 flex justify-end gap-2">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
