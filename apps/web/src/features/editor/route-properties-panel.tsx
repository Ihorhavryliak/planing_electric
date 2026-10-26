import type {
  PublicMaterial,
  PublicRoute,
  RouteCalculation,
  UpdateRouteInput,
} from '@drawmyplace/contracts';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { CommitField } from './commit-field';
import { formatMeters } from './editor-geometry';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';

interface RoutePropertiesPanelProps {
  route: PublicRoute;
  calculation: RouteCalculation | undefined;
  materials: PublicMaterial[];
  onChange: (patch: UpdateRouteInput) => void;
  onDelete: () => void;
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
  onChange,
  onDelete,
}: RoutePropertiesPanelProps) {
  const { t } = useI18n();
  const cableMaterials = materials.filter(
    (material) => material.category === 'cable' || material.category === null,
  );
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
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
        <CommitField
          key={`${route.id}-circuit-${route.circuitId ?? ''}`}
          label={t('editor.circuit')}
          initial={route.circuitId ?? ''}
          placeholder={t('editor.circuitPlaceholder')}
          maxLength={40}
          onCommit={(raw) => {
            onChange({ circuitId: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />
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
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
