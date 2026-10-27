import type {
  Circuit,
  PublicMaterial,
  PublicPoint,
  PublicRoute,
  RouteCalculation,
  RouteMounting,
  SignalingLoop,
  UpdateRouteInput,
} from '@drawmyplace/contracts';
import { Magnet, Trash2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { CommitField } from './commit-field';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';

interface RoutePropertiesPanelProps {
  route: PublicRoute;
  calculation: RouteCalculation | undefined;
  materials: PublicMaterial[];
  circuits?: readonly Circuit[];
  signalingLoops?: readonly SignalingLoop[];
  points?: readonly PublicPoint[];
  penetrationCount?: number;
  onChange: (patch: UpdateRouteInput) => void;
  onDelete: () => void;
  onAttachEnd?: (end: 'start' | 'end') => void;
  onDetachEnd?: (end: 'start' | 'end') => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100 tabular-nums">{value}</span>
    </div>
  );
}

export function RoutePropertiesPanel({
  route,
  calculation,
  materials,
  circuits = [],
  signalingLoops = [],
  points = [],
  penetrationCount = 0,
  onChange,
  onDelete,
  onAttachEnd,
  onDetachEnd,
}: RoutePropertiesPanelProps) {
  const { t, formatMeters } = useI18n();
  const cableMaterials = materials.filter(
    (material) => material.category === 'cable' || material.category === null,
  );
  const mounting: RouteMounting | '' = route.settings.mounting ?? '';
  const isChase = mounting === 'chase';

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('editor.cableRoute')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {t('editor.bends', { count: route.geometry.length })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-slate-400">{t('mounting.label')}</span>
          <select
            value={mounting}
            onChange={(event) => {
              const value = event.target.value as RouteMounting | '';
              onChange({
                settings: {
                  ...route.settings,
                  ...(value === ''
                    ? { mounting: undefined }
                    : { mounting: value }),
                  ...(value === 'chase'
                    ? {
                        chaseWidthMm: route.settings.chaseWidthMm ?? 60,
                        chaseDepthMm: route.settings.chaseDepthMm ?? 25,
                      }
                    : {}),
                },
              });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">{t('mounting.none')}</option>
            <option value="ceiling">{t('mounting.ceiling')}</option>
            <option value="floor">{t('mounting.floor')}</option>
            <option value="wall">{t('mounting.wall')}</option>
            <option value="chase">{t('mounting.chase')}</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-slate-400">{t('signaling.system')}</span>
          <select
            value={route.settings.system ?? 'power'}
            onChange={(event) => {
              const system = event.target.value as
                | 'power'
                | 'security'
                | 'fire'
                | 'cctv'
                | 'pa'
                | 'data';
              const loop =
                system === 'power'
                  ? null
                  : signalingLoops.find((item) => item.type === system) ?? null;
              onChange({
                settings: {
                  ...route.settings,
                  system,
                  ...(loop ? { loopId: loop.id } : { loopId: undefined }),
                },
              });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          >
            {(['power', 'security', 'fire', 'cctv', 'pa', 'data'] as const).map(
              (system) => (
                <option key={system} value={system}>
                  {t(`signaling.system.${system}`)}
                </option>
              ),
            )}
          </select>
        </label>
        {(route.settings.system ?? 'power') !== 'power' ? (
          <label className="block text-xs">
            <span className="text-slate-400">{t('signaling.loop')}</span>
            <select
              value={route.settings.loopId ?? ''}
              onChange={(event) =>
                onChange({
                  settings: {
                    ...route.settings,
                    loopId: event.target.value || undefined,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="">{t('signaling.noLoop')}</option>
              {signalingLoops
                .filter(
                  (loop) =>
                    loop.type === route.settings.system ||
                    (route.settings.system === 'security' &&
                      loop.type === 'combined'),
                )
                .map((loop) => (
                  <option key={loop.id} value={loop.id}>
                    {loop.code} · {loop.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <label className="block text-xs">
          <span className="text-slate-400">{t('editor.cableType')}</span>
          <select
            value={route.materialId ?? ''}
            onChange={(event) =>
              onChange({
                materialId: event.target.value === '' ? null : event.target.value,
              })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">{t('editor.defaultCable')}</option>
            {cableMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
                {material.unitPrice !== null ? ` · ${material.unitPrice}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-slate-400">{t('circuits.circuit')}</span>
          <select
            value={route.circuitId ?? ''}
            onChange={(event) =>
              onChange({
                circuitId:
                  event.target.value === '' ? null : event.target.value,
              })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">{t('circuits.none')}</option>
            {circuits.map((circuit) => (
              <option key={circuit.id} value={circuit.id}>
                {circuit.id} · {circuit.name}
              </option>
            ))}
            {route.circuitId &&
            !circuits.some((circuit) => circuit.id === route.circuitId) ? (
              <option value={route.circuitId}>
                {t('circuits.unknown')}: {route.circuitId}
              </option>
            ) : null}
          </select>
        </label>
        <CommitField
          key={`${route.id}-waste-${route.settings.wastePercent ?? ''}`}
          label={t('editor.waste')}
          hint="%"
          inputMode="decimal"
          initial={formatFieldNumber(route.settings.wastePercent)}
          placeholder={t('editor.wastePlaceholder')}
          onCommit={(raw) => {
            const parsed = parseOptionalNumber(raw, {
              label: t('editor.waste'),
              min: 0,
              max: 100,
            });

            if (!parsed.ok) {
              return parsed.error;
            }

            const { wastePercent: _previous, ...rest } = route.settings;

            onChange({
              settings:
                parsed.value === null
                  ? rest
                  : { ...rest, wastePercent: parsed.value },
            });

            return null;
          }}
        />
        {isChase ? (
          <>
            <CommitField
              key={`${route.id}-chase-width-${route.settings.chaseWidthMm ?? ''}`}
              label={t('editor.chaseWidth')}
              hint="mm"
              inputMode="decimal"
              initial={formatFieldNumber(route.settings.chaseWidthMm)}
              placeholder="60"
              onCommit={(raw) => {
                const parsed = parseOptionalNumber(raw, {
                  label: t('editor.chaseWidth'),
                  min: 10,
                  max: 400,
                });

                if (!parsed.ok) return parsed.error;

                onChange({
                  settings: {
                    ...route.settings,
                    chaseWidthMm: parsed.value ?? 60,
                  },
                });

                return null;
              }}
            />
            <CommitField
              key={`${route.id}-chase-depth-${route.settings.chaseDepthMm ?? ''}`}
              label={t('editor.chaseDepth')}
              hint="mm"
              inputMode="decimal"
              initial={formatFieldNumber(route.settings.chaseDepthMm)}
              placeholder="25"
              onCommit={(raw) => {
                const parsed = parseOptionalNumber(raw, {
                  label: t('editor.chaseDepth'),
                  min: 5,
                  max: 150,
                });

                if (!parsed.ok) return parsed.error;

                onChange({
                  settings: {
                    ...route.settings,
                    chaseDepthMm: parsed.value ?? 25,
                  },
                });

                return null;
              }}
            />
          </>
        ) : null}
      </div>

      <div className="mt-4 editor-subpanel p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t('routePins.title')}
        </h3>
        <div className="mt-2 space-y-1.5">
          {(['start', 'end'] as const).map((end) => {
            const pointId =
              end === 'start' ? route.startPointId : route.endPointId;
            const point = points.find((item) => item.id === pointId);
            const pinned = Boolean(pointId);
            const at =
              end === 'start'
                ? route.geometry[0]
                : route.geometry[route.geometry.length - 1];
            const mismatch =
              Boolean(point && at) &&
              (Math.abs((at?.x ?? 0) - (point?.x ?? 0)) > 1e-6 ||
                Math.abs((at?.y ?? 0) - (point?.y ?? 0)) > 1e-6);
            const sync = () => {
              if (!point) return;
              onChange({
                geometry: route.geometry.map((vertex, index) =>
                  (end === 'start' && index === 0) ||
                  (end === 'end' && index === route.geometry.length - 1)
                    ? { x: point.x, y: point.y }
                    : vertex,
                ),
              });
            };

            return (
              <div
                key={end}
                data-testid={`route-pin-${end}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950/40 px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[11px]">
                  <Magnet
                    className={`h-3.5 w-3.5 shrink-0 ${
                      pinned ? 'text-amber-300' : 'text-slate-600'
                    }`}
                  />
                  <span className="shrink-0 text-slate-500">
                    {t(`routePins.${end}`)}
                  </span>
                  <span
                    data-testid={`route-pin-status-${end}`}
                    className="truncate text-slate-200"
                  >
                    {pinned
                      ? point?.label?.trim() ||
                        t(`editor.point.${point?.type ?? 'custom'}`)
                      : t('routePins.free')}
                  </span>
                </span>
                {pinned ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {mismatch ? (
                      <button
                        type="button"
                        onClick={sync}
                        className="rounded-md px-1.5 py-0.5 text-[10px] text-amber-200 transition hover:bg-amber-400/10"
                      >
                        {t('routePins.sync')}
                      </button>
                    ) : null}
                  <button
                    type="button"
                    data-testid={`route-detach-${end}`}
                    onClick={() => onDetachEnd?.(end)}
                    aria-label={t('routePins.detachEnd', {
                      end: t(`routePins.${end}`),
                    })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <Unlink className="h-3 w-3" />
                    {t('routePins.detach')}
                  </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid={`route-attach-${end}`}
                    onClick={() => onAttachEnd?.(end)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-amber-200 transition hover:bg-amber-400/10"
                  >
                    {t('routePins.attachNearest')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 editor-subpanel p-3">
        {calculation?.status === 'ok' ? (
          <>
            <Row
              label={t('editor.alongPlan')}
              value={formatMeters(calculation.planLength ?? 0)}
            />
            {calculation.drops.map((drop) => (
              <Row
                key={drop.pointId}
                label={t('editor.dropLabel', { label: drop.label })}
                value={formatMeters(drop.meters)}
              />
            ))}
            <Row
              label={t('editor.penetrations')}
              value={String(penetrationCount)}
            />
            <Row
              label={t('editor.wastePercent', {
                percent: calculation.wastePercent ?? 0,
              })}
              value={formatMeters(calculation.wasteLength ?? 0)}
            />
            <div className="border-t border-white/10 pt-1.5">
              <Row
                label={t('editor.cableRequired')}
                value={formatMeters(calculation.requiredLength ?? 0)}
              />
            </div>
            {calculation.drops.length === 0 ? (
              <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
                {t('editor.noDrops')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-slate-400">
            {calculation
              ? t('editor.realLengthUnavailable')
              : t('editor.calculating')}
          </p>
        )}
      </div>

      {calculation?.warnings.map((warning) => (
        <p key={warning} className="mt-2 text-[11px] text-amber-200">
          {warning}
        </p>
      ))}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t('editor.routeNote')}
      </p>

      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        {t('editor.deleteRoute')}
      </Button>
    </section>
  );
}
