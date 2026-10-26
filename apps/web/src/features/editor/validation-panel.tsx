import { AlertTriangle, CircleAlert, Info } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/features/i18n/i18n-context';
import type {
  ValidationIssue,
  ValidationSeverity,
  ValidationTarget,
} from './validation';

interface ValidationPanelProps {
  issues: readonly ValidationIssue[];
  onSelectTarget?: (target: ValidationTarget) => void;
}

type Filter = 'all' | ValidationSeverity;

const SEVERITY_STYLE: Record<
  ValidationSeverity,
  { chip: string; icon: string; label: string }
> = {
  error: {
    chip: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    icon: 'text-rose-300',
    label: 'validation.errors',
  },
  warning: {
    chip: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    icon: 'text-amber-300',
    label: 'validation.warnings',
  },
  info: {
    chip: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
    icon: 'text-sky-300',
    label: 'validation.info',
  },
};

function SeverityIcon({ severity }: { severity: ValidationSeverity }) {
  const className = `h-3.5 w-3.5 shrink-0 ${SEVERITY_STYLE[severity].icon}`;

  if (severity === 'error') return <CircleAlert className={className} />;
  if (severity === 'warning') return <AlertTriangle className={className} />;
  return <Info className={className} />;
}

export function ValidationPanel({
  issues,
  onSelectTarget,
}: ValidationPanelProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const totals = {
    error: issues.filter((issue) => issue.severity === 'error').length,
    warning: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
  const visible =
    filter === 'all'
      ? issues
      : issues.filter((issue) => issue.severity === filter);

  return (
    <section data-tour="validation" className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('validation.title')}
        </h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            issues.length === 0
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-white/10 bg-white/5 text-slate-300'
          }`}
        >
          {issues.length === 0 ? t('validation.clean') : issues.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('validation.hint')}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
          className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
            filter === 'all'
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}
        >
          {t('validation.all')} {issues.length}
        </button>
        {(['error', 'warning', 'info'] as const).map((severity) => (
          <button
            key={severity}
            type="button"
            aria-pressed={filter === severity}
            onClick={() => setFilter(severity)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
              filter === severity
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            {t(SEVERITY_STYLE[severity].label)} {totals[severity]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-3 text-xs leading-relaxed text-emerald-100">
          {issues.length === 0
            ? t('validation.empty')
            : t('validation.noneInFilter')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {visible.map((issue) => {
            const firstTarget = issue.targets[0];
            const clickable = Boolean(firstTarget && onSelectTarget);

            return (
              <li key={issue.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (firstTarget) onSelectTarget?.(firstTarget);
                  }}
                  className={`flex w-full items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left transition ${
                    clickable ? 'hover:border-white/15 hover:bg-white/[0.06]' : ''
                  }`}
                >
                  <SeverityIcon severity={issue.severity} />
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-300">
                    {t(`validation.${issue.code}`, issue.params)}
                    {issue.norm ? (
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {t('validation.norm', { norm: issue.norm })}
                      </span>
                    ) : null}
                  </span>
                  {issue.count > 1 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
                      {issue.count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
