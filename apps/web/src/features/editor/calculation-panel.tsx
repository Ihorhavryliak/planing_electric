import type { PlanCalculation, PublicRoute } from '@drawmyplace/contracts';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/features/i18n/i18n-context';
import { formatMeters } from './editor-geometry';

interface CalculationPanelProps {
  routes: readonly PublicRoute[];
  calculation: PlanCalculation | null;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

export function CalculationPanel({
  routes,
  calculation,
  loading,
  error,
  actionError,
  selectedRouteId,
  onSelectRoute,
}: CalculationPanelProps) {
  const { t } = useI18n();
  const results = new Map(
    (calculation?.routes ?? []).map((item) => [item.routeId, item]),
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('editor.cableRoutes')}
        </h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          {loading ? <LoaderCircle className="h-3 w-3 animate-spin" /> : null}
          {routes.length}
        </span>
      </div>

      {routes.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          {t('editor.routesEmpty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {routes.map((route, index) => {
            const result = results.get(route.id);

            return (
              <li key={route.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoute(route.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                    route.id === selectedRouteId
                      ? 'bg-amber-400/15 text-amber-100'
                      : 'text-slate-300 hover:bg-white/5',
                  )}
                >
                  <span>
                    {route.circuitId ??
                      t('editor.routeN', { index: index + 1 })}
                  </span>
                  <span className="tabular-nums">
                    {result?.requiredLength != null
                      ? formatMeters(result.requiredLength)
                      : '—'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {calculation && routes.length > 0 ? (
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
          <span className="text-slate-400">{t('editor.totalCable')}</span>
          <span className="font-semibold text-white tabular-nums">
            {calculation.totalRequiredLength != null
              ? formatMeters(calculation.totalRequiredLength)
              : '—'}
          </span>
        </div>
      ) : null}

      {calculation?.warnings.map((warning) => (
        <p key={warning} className="mt-2 text-[11px] leading-relaxed text-amber-200">
          {warning}
        </p>
      ))}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-rose-300">
          {t('editor.calcFailed', { error })}
        </p>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
        >
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
