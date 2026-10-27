import type { PublicMaterial, SignalingLoop } from '@drawmyplace/contracts';
import type {
  SignalingIssue,
  SignalingTakeoff,
} from '@drawmyplace/calculations';
import {
  BatteryCharging,
  Camera,
  Cable,
  CircleAlert,
  Flame,
  Network,
  Plus,
  RadioTower,
  ShieldCheck,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

interface SignalingPanelProps {
  loops: readonly SignalingLoop[];
  takeoff: SignalingTakeoff;
  materials?: readonly PublicMaterial[];
  selectedLoopId?: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<SignalingLoop>) => void;
  onDelete: (id: string) => void;
  onSelectLoop?: (id: string) => void;
}

const LOOP_TYPES: SignalingLoop['type'][] = [
  'security',
  'fire',
  'combined',
  'access',
  'cctv',
  'pa',
];

const TOPOLOGIES: NonNullable<SignalingLoop['topology']>[] = [
  'radial',
  'loop',
  'bus',
];

function issueText(issue: SignalingIssue, t: (key: string, params?: Record<string, string | number>) => string) {
  return t(`signaling.issue.${issue.code}`, issue.params);
}

export function SignalingPanel({
  loops,
  takeoff,
  materials = [],
  selectedLoopId = null,
  onAdd,
  onUpdate,
  onDelete,
  onSelectLoop,
}: SignalingPanelProps) {
  const { t, formatMeters, formatNumber } = useI18n();
  const [openLoopId, setOpenLoopId] = useState<string | null>(selectedLoopId);
  const cableMaterials = materials.filter(
    (material) => material.category === 'cable',
  );
  const battery = takeoff.battery;

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <RadioTower className="h-4 w-4 text-[var(--dmp-color-brand)]" />
          {t('signaling.title')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {loops.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('signaling.hint')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          {
            icon: ShieldCheck,
            label: t('signaling.kpi.devices'),
            value: formatNumber(takeoff.totalDevices),
          },
          {
            icon: Cable,
            label: t('signaling.kpi.cable'),
            value: formatMeters(takeoff.totalCableMeters),
          },
          {
            icon: BatteryCharging,
            label: t('signaling.kpi.battery'),
            value: `${formatNumber(battery.recommendedAh)} Ah`,
          },
          {
            icon: Camera,
            label: t('signaling.kpi.cameras'),
            value: formatNumber(takeoff.cctv.cameras),
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <Icon className="h-3 w-3 text-[var(--dmp-color-brand)]" />
              <span className="truncate">{label}</span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
        <span className="rounded-full border border-white/10 px-2 py-0.5">
          {t('signaling.fireDetectors', { count: takeoff.fire.detectors })}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">
          {t('signaling.scsPorts', { count: takeoff.scs.ports })}
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">
          {t('signaling.archive', {
            size: formatNumber(takeoff.cctv.archiveGbPerDay),
          })}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {t('signaling.loops')}
        </span>
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          {t('signaling.addLoop')}
        </Button>
      </div>

      {loops.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center text-xs text-slate-500">
          {t('signaling.empty')}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {takeoff.loops.map((result) => {
            const loop = loops.find((item) => item.id === result.id);
            if (!loop) return null;
            const open = loop.id === openLoopId;
            const progress = Math.min(
              100,
              (result.deviceCount / Math.max(1, result.maxDevices ?? 128)) * 100,
            );

            return (
              <li
                key={loop.id}
                className="rounded-xl border border-white/8 bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = open ? null : loop.id;
                    setOpenLoopId(next);
                    if (next) onSelectLoop?.(next);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: loop.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[var(--dmp-color-brand)]">
                        {loop.code}
                      </span>
                      <span className="truncate text-xs text-slate-200">
                        {loop.name}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{t(`signaling.type.${loop.type}`)}</span>
                      <span>·</span>
                      <span>
                        {result.deviceCount}/{result.maxDevices ?? 128}
                      </span>
                      <span>·</span>
                      <span>{formatMeters(result.cableMeters)}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                      result.status === 'ok'
                        ? 'bg-emerald-400/10 text-emerald-300'
                        : result.status === 'warning'
                          ? 'bg-amber-400/10 text-amber-200'
                          : 'bg-rose-400/10 text-rose-300',
                    )}
                  >
                    {t(`signaling.status.${result.status}`)}
                  </span>
                </button>

                <div className="px-2.5 pb-2">
                  <div className="h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        result.status === 'error'
                          ? 'bg-rose-400'
                          : result.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400',
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {open && loop ? (
                  <div className="space-y-2 border-t border-white/5 p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.code')}
                        <Input
                          value={loop.code}
                          onChange={(event) =>
                            onUpdate(loop.id, { code: event.target.value })
                          }
                          className="mt-1 h-7 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.name')}
                        <Input
                          value={loop.name}
                          onChange={(event) =>
                            onUpdate(loop.id, { name: event.target.value })
                          }
                          className="mt-1 h-7 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.type')}
                        <select
                          value={loop.type}
                          onChange={(event) =>
                            onUpdate(loop.id, {
                              type: event.target.value as SignalingLoop['type'],
                            })
                          }
                          className="mt-1 h-7 w-full rounded-md border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
                        >
                          {LOOP_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {t(`signaling.type.${type}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.topology')}
                        <select
                          value={loop.topology ?? 'radial'}
                          onChange={(event) =>
                            onUpdate(loop.id, {
                              topology: event.target
                                .value as NonNullable<SignalingLoop['topology']>,
                            })
                          }
                          className="mt-1 h-7 w-full rounded-md border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
                        >
                          {TOPOLOGIES.map((topology) => (
                            <option key={topology} value={topology}>
                              {t(`signaling.topology.${topology}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.maxDevices')}
                        <Input
                          type="number"
                          min="1"
                          value={loop.maxDevices ?? 128}
                          onChange={(event) =>
                            onUpdate(loop.id, {
                              maxDevices: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                          className="mt-1 h-7 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.maxLength')}
                        <Input
                          type="number"
                          min="1"
                          value={loop.maxLength ?? 500}
                          onChange={(event) =>
                            onUpdate(loop.id, {
                              maxLength: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                          className="mt-1 h-7 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.voltage')}
                        <Input
                          type="number"
                          min="1"
                          value={loop.voltageV ?? 24}
                          onChange={(event) =>
                            onUpdate(loop.id, {
                              voltageV: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                          className="mt-1 h-7 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        {t('signaling.field.color')}
                        <input
                          type="color"
                          value={loop.color}
                          onChange={(event) =>
                            onUpdate(loop.id, { color: event.target.value })
                          }
                          className="mt-1 h-7 w-full cursor-pointer rounded-md border border-white/10 bg-transparent"
                        />
                      </label>
                    </div>
                    <label className="block text-[10px] text-slate-500">
                      {t('signaling.field.cable')}
                      <select
                        value={loop.cableMaterialId ?? ''}
                        onChange={(event) =>
                          onUpdate(loop.id, {
                            cableMaterialId: event.target.value || null,
                          })
                        }
                        className="mt-1 h-7 w-full rounded-md border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
                      >
                        <option value="">{t('signaling.field.noCable')}</option>
                        {cableMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.code} · {material.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className="text-[10px] leading-relaxed text-slate-500">
                      {t('signaling.loopStats', {
                        standby: formatNumber(result.standbyA, {
                          maximumFractionDigits: 3,
                        }),
                        alarm: formatNumber(result.alarmA, {
                          maximumFractionDigits: 3,
                        }),
                        drop: formatNumber(result.voltageDropPercent, {
                          maximumFractionDigits: 1,
                        }),
                      })}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-rose-300 hover:text-rose-200"
                        onClick={() => onDelete(loop.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('signaling.deleteLoop')}
                      </Button>
                      <span className="text-[9px] text-slate-600">
                        {loop.zone ? `${t('signaling.zone')} ${loop.zone}` : ''}
                      </span>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {takeoff.issues.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
            <CircleAlert className="h-3 w-3" />
            {t('signaling.issues', { count: takeoff.issues.length })}
          </p>
          <ul className="mt-1.5 space-y-1">
            {takeoff.issues.slice(0, 5).map((issue, index) => (
              <li
                key={`${issue.code}:${index}`}
                className="text-[10px] leading-relaxed text-slate-300"
              >
                {issueText(issue, t)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-[10px] text-slate-500">
        <p className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-rose-300" />
            {t('signaling.fireCoverage')}
          </span>
          <span className="text-slate-300">
            {takeoff.fire.detectors} · {takeoff.fire.uncoveredRooms.length}
          </span>
        </p>
        <p className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-sky-300" />
            {t('signaling.cctvCoverage')}
          </span>
          <span className="text-slate-300">
            {takeoff.cctv.cameras} · {takeoff.cctv.blindSpotRooms.length}
          </span>
        </p>
        <p className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Network className="h-3 w-3 text-emerald-300" />
            {t('signaling.scsSummary')}
          </span>
          <span className="text-slate-300">
            {takeoff.scs.ports}/{Math.max(24, takeoff.scs.patchPanels * 24)}
          </span>
        </p>
      </div>
    </section>
  );
}
