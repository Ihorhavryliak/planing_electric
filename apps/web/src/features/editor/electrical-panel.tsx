import type { ElectricalSettings } from '@drawmyplace/contracts';
import type {
  ElectricalPlanResult,
  ElectricalSettings as ResolvedElectricalSettings,
} from '@drawmyplace/calculations';
import {
  CABLE_SECTIONS_MM2,
  BREAKER_RATINGS_A,
} from '@drawmyplace/calculations';
import { AlertTriangle, CircleAlert, Info, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import { useI18n } from '@/features/i18n/i18n-context';

interface ElectricalPanelProps {
  result: ElectricalPlanResult;
  onSettingsChange: (settings: ElectricalSettings) => void;
  onSelectCircuit?: (circuitId: string) => void;
}

const SEVERITY_ICON = {
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_CLASS = {
  error: 'text-rose-300',
  warning: 'text-amber-300',
  info: 'text-sky-300',
} as const;

function numeric(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Live electrical engineering summary: installed and demand power, design
 * current, cable/breaker coordination, voltage drop and fault level. The
 * compact settings block writes back to `plan.calculationSettings.electrical`.
 */
export function ElectricalPanel({
  result,
  onSettingsChange,
  onSelectCircuit,
}: ElectricalPanelProps) {
  const { t, formatNumber } = useI18n();
  const [settings, setSettings] = useState<ResolvedElectricalSettings>(
    result.settings,
  );
  const settingsRef = useRef<ResolvedElectricalSettings>(result.settings);

  const errorCount = result.issues.filter(
    (issue) => issue.severity === 'error',
  ).length;
  const warningCount = result.issues.filter(
    (issue) => issue.severity === 'warning',
  ).length;

  function update(patch: Partial<ElectricalSettings>) {
    // Merge against the latest local draft so two quick select changes do not
    // overwrite each other before the server response arrives.
    const next: ResolvedElectricalSettings = {
      ...settingsRef.current,
      ...patch,
    } as ResolvedElectricalSettings;
    settingsRef.current = next;
    setSettings(next);
    onSettingsChange(next);
  }

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Zap className="h-4 w-4 text-amber-300" />
          {t('electrical.title')}
        </h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            errorCount > 0
              ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
              : warningCount > 0
                ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
          }`}
        >
          {errorCount > 0
            ? t('electrical.errors', { count: errorCount })
            : warningCount > 0
              ? t('electrical.warnings', { count: warningCount })
              : t('electrical.ok')}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('electrical.hint')}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('electrical.installed')}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-white">
            {formatNumber(result.totalConnectedPowerW / 1_000, {
              maximumFractionDigits: 2,
            })}{' '}
            kW
          </dd>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('electrical.demand')}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-white">
            {formatNumber(result.totalDemandPowerW / 1_000, {
              maximumFractionDigits: 2,
            })}{' '}
            kW
          </dd>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('electrical.current')}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-white">
            {formatNumber(result.maxPhaseCurrentA, {
              maximumFractionDigits: 1,
            })}{' '}
            A
          </dd>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {t('electrical.worstDrop')}
          </dt>
          <dd
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              result.calibrated && result.worstVoltageDropPercent > 5
                ? 'text-rose-200'
                : 'text-white'
            }`}
          >
            {result.calibrated
              ? `${formatNumber(result.worstVoltageDropPercent, {
                  maximumFractionDigits: 1,
                })}%`
              : '—'}
          </dd>
        </div>
      </dl>

      {!result.calibrated ? (
        <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-100">
          {t('electrical.uncalibrated')}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-400">
          {t('electrical.supply')}
          <select
            value={settings.supply}
            onChange={(event) =>
              update({ supply: event.target.value as ElectricalSettings['supply'] })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 focus:border-amber-400/60 focus:outline-none"
          >
            <option value="single-phase">{t('electrical.singlePhase')}</option>
            <option value="three-phase">{t('electrical.threePhase')}</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          {t('electrical.sourceFault')}
          <select
            value={settings.sourceFaultCurrentKa}
            onChange={(event) =>
              update({
                sourceFaultCurrentKa: numeric(
                  event.target.value,
                  settings.sourceFaultCurrentKa,
                ),
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 focus:border-amber-400/60 focus:outline-none"
          >
            {[3, 6, 10, 15, 20, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value} kA
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          {t('electrical.cable')}
          <select
            value={settings.defaultCable.sectionMm2}
            onChange={(event) =>
              update({
                defaultCable: {
                  ...settings.defaultCable,
                  sectionMm2: numeric(
                    event.target.value,
                    settings.defaultCable.sectionMm2,
                  ),
                },
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 focus:border-amber-400/60 focus:outline-none"
          >
            {CABLE_SECTIONS_MM2.map((value) => (
              <option key={value} value={value}>
                {value} mm²
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          {t('electrical.breaker')}
          <select
            value={settings.defaultBreaker.ratingA}
            onChange={(event) =>
              update({
                defaultBreaker: {
                  ...settings.defaultBreaker,
                  ratingA: numeric(
                    event.target.value,
                    settings.defaultBreaker.ratingA,
                  ),
                },
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 focus:border-amber-400/60 focus:outline-none"
          >
            {BREAKER_RATINGS_A.map((value) => (
              <option key={value} value={value}>
                {value} A
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          {t('electrical.conductor')}
          <select
            value={settings.defaultCable.material}
            onChange={(event) =>
              update({
                defaultCable: {
                  ...settings.defaultCable,
                  material: event.target.value as NonNullable<
                    ElectricalSettings['defaultCable']
                  >['material'],
                },
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 focus:border-amber-400/60 focus:outline-none"
          >
            <option value="copper">{t('electrical.copper')}</option>
            <option value="aluminium">{t('electrical.aluminium')}</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={settings.defaultRcd !== null}
            onChange={(event) =>
              update({
                defaultRcd: event.target.checked
                  ? { ratingA: 25, sensitivityMa: 30 }
                  : null,
              })
            }
            className="h-4 w-4 rounded border-white/20 bg-slate-950"
          />
          {t('electrical.rcd')}
        </label>
      </div>

      {result.circuits.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {result.circuits.map((circuit) => {
            const failing = result.issues.filter(
              (issue) =>
                issue.circuitId === circuit.id && issue.severity === 'error',
            ).length;
            const dropping = !circuit.voltageDropOk;

            return (
              <li key={circuit.id}>
                <button
                  type="button"
                  onClick={() => onSelectCircuit?.(circuit.id)}
                  className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] font-medium text-slate-200">
                      <span className="font-mono text-amber-200">{circuit.id}</span>{' '}
                      {circuit.name}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] ${
                        failing > 0
                          ? 'text-rose-300'
                          : dropping
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                      }`}
                    >
                      {failing > 0
                        ? t('electrical.circuitError')
                        : dropping
                          ? t('electrical.circuitWarning')
                          : t('electrical.circuitOk')}
                    </span>
                  </span>
                  <span className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-slate-400">
                    <span>
                      <span className="block text-slate-500">
                        {t('electrical.load')}
                      </span>
                      {formatNumber(circuit.currentA, {
                        maximumFractionDigits: 1,
                      })}{' '}
                      A
                    </span>
                    <span>
                      <span className="block text-slate-500">
                        {t('electrical.breakerShort')}
                      </span>
                      {circuit.breaker.ratingA} A
                    </span>
                    <span>
                      <span className="block text-slate-500">
                        {t('electrical.cableShort')}
                      </span>
                      {circuit.cable.sectionMm2} mm²
                    </span>
                    <span>
                      <span className="block text-slate-500">
                        {t('electrical.dropShort')}
                      </span>
                      <span
                        className={
                          result.calibrated &&
                          circuit.voltageDropPercent > 5
                            ? 'text-rose-200'
                            : undefined
                        }
                      >
                        {result.calibrated
                          ? `${formatNumber(circuit.voltageDropPercent, {
                              maximumFractionDigits: 1,
                            })}%`
                          : '—'}
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>
                      {t('electrical.fault')}{' '}
                      {result.calibrated
                        ? `${formatNumber(circuit.faultCurrentA, {
                            maximumFractionDigits: 0,
                          })} A`
                        : '—'}
                    </span>
                    <span
                      className={
                        circuit.phase === 'L1'
                          ? 'rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 text-amber-200'
                          : circuit.phase === 'L2'
                            ? 'rounded-full border border-sky-400/25 bg-sky-400/10 px-1.5 text-sky-200'
                            : 'rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 text-emerald-200'
                      }
                    >
                      {circuit.phase}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {t('electrical.noCircuits')}
        </p>
      )}

      {result.issues.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {result.issues.map((issue, index) => {
            const Icon = SEVERITY_ICON[issue.severity];

            return (
              <li key={`${issue.code}:${issue.circuitId ?? 'plan'}:${index}`}>
                <button
                  type="button"
                  disabled={!issue.circuitId || !onSelectCircuit}
                  onClick={() => {
                    if (issue.circuitId) onSelectCircuit?.(issue.circuitId);
                  }}
                  className={`flex w-full items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left ${
                    issue.circuitId && onSelectCircuit
                      ? 'hover:border-white/15 hover:bg-white/[0.05]'
                      : ''
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${SEVERITY_CLASS[issue.severity]}`}
                  />
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-300">
                    {t(`electrical.issue.${issue.code}`, issue.params)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
