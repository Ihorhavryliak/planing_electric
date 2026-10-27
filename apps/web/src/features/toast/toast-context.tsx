import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<
  ToastTone,
  { icon: typeof CheckCircle2; className: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-400/[0.08]',
    iconClass: 'text-emerald-300',
  },
  error: {
    icon: CircleAlert,
    className: 'border-rose-400/25 bg-rose-400/[0.08]',
    iconClass: 'text-rose-300',
  },
  info: {
    icon: Info,
    className: 'border-sky-400/25 bg-sky-400/[0.08]',
    iconClass: 'text-sky-300',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const record: ToastRecord = { ...options, id };
      setToasts((current) => [...current.slice(-3), record]);
      const timer = window.setTimeout(
        () => dismiss(id),
        options.durationMs ?? (options.tone === 'error' ? 8000 : 5000),
      );
      timers.current.set(id, timer);

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => {
          const tone = item.tone ?? 'info';
          const style = TONE_STYLE[tone];
          const Icon = style.icon;

          return (
            <div
              key={item.id}
              role={tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-slate-100 shadow-xl shadow-black/30 backdrop-blur-xl motion-safe:animate-[dmp-scale-in_180ms_ease-out]',
                style.className,
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconClass)} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="mt-1.5 text-[11px] font-medium text-[var(--dmp-color-brand)] underline-offset-4 hover:underline"
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}
