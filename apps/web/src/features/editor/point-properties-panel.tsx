import {
  DEVICE_SUBTYPES,
  type Circuit,
  type DeviceSubtype,
  type ElectricalPointType,
  type PublicPoint,
  type UpdatePointInput,
} from '@drawmyplace/contracts';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { CommitField } from './commit-field';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';
import { POINT_SYMBOL_LIST, POINT_SYMBOLS } from './point-symbols';

interface PointPropertiesPanelProps {
  point: PublicPoint;
  circuits?: readonly Circuit[];
  onChange: (patch: UpdatePointInput) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PointPropertiesPanel({
  point,
  circuits = [],
  onChange,
  onDuplicate,
  onDelete,
}: PointPropertiesPanelProps) {
  const { t } = useI18n();
  const symbol = POINT_SYMBOLS[point.type];
  const subtypeOptions = DEVICE_SUBTYPES.filter(
    (definition) => definition.type === point.type,
  );

  function commitNumber(
    raw: string,
    label: string,
    min: number,
    max: number,
    apply: (value: number | null) => UpdatePointInput | null,
  ): string | null {
    const parsed = parseOptionalNumber(raw, { label, min, max });

    if (!parsed.ok) {
      return parsed.error;
    }

    const patch = apply(parsed.value);

    if (patch) {
      onChange(patch);
    }

    return null;
  }

  function commitCoordinate(raw: string, axis: 'x' | 'y'): string | null {
    const parsed = parseOptionalNumber(raw, {
      label: t('editor.coordinate', { axis: axis.toUpperCase() }),
      min: -10_000_000,
      max: 10_000_000,
    });

    if (!parsed.ok) {
      return parsed.error;
    }

    if (parsed.value === null) {
      return t('editor.coordinateRequired');
    }

    onChange(axis === 'x' ? { x: parsed.value } : { y: parsed.value });

    return null;
  }

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: symbol.color }}
        />
        <h2 className="text-sm font-semibold text-white">
          {t(`editor.point.${point.type}`)}
        </h2>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-slate-400">{t('editor.type')}</span>
          <select
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            value={point.type}
            onChange={(event) =>
              onChange({ type: event.target.value as ElectricalPointType })
            }
          >
            {POINT_SYMBOL_LIST.map((item) => (
              <option key={item.type} value={item.type}>
                {t(`editor.point.${item.type}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-slate-400">
            {t('devices.subtype')}
          </span>
          <select
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            value={point.properties.subtype ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              const { subtype: _previous, ...rest } = point.properties;
              onChange({
                properties: value
                  ? { ...rest, subtype: value as DeviceSubtype }
                  : rest,
              });
            }}
          >
            <option value="">{t('devices.generic')}</option>
            {subtypeOptions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {t(`devices.subtype.${definition.id}`)}
              </option>
            ))}
            {point.properties.subtype &&
            !subtypeOptions.some(
              (definition) => definition.id === point.properties.subtype,
            ) ? (
              <option value={point.properties.subtype}>
                {t('circuits.unknown')}: {point.properties.subtype}
              </option>
            ) : null}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-slate-400">
            {t('circuits.circuit')}
          </span>
          <select
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            value={point.properties.circuitId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              const { circuitId: _previous, ...rest } = point.properties;
              onChange({
                properties: value ? { ...rest, circuitId: value } : rest,
              });
            }}
          >
            <option value="">{t('circuits.none')}</option>
            {circuits.map((circuit) => (
              <option key={circuit.id} value={circuit.id}>
                {circuit.id} · {circuit.name}
              </option>
            ))}
            {point.properties.circuitId &&
            !circuits.some(
              (circuit) => circuit.id === point.properties.circuitId,
            ) ? (
              <option value={point.properties.circuitId}>
                {t('circuits.unknown')}: {point.properties.circuitId}
              </option>
            ) : null}
          </select>
        </label>

        <CommitField
          key={`${point.id}-label-${point.label ?? ''}`}
          label={t('editor.label')}
          initial={point.label ?? ''}
          placeholder={t('editor.labelPlaceholder')}
          maxLength={60}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <CommitField
            key={`${point.id}-height-${point.mountingHeight ?? ''}`}
            label={t('editor.mountingHeight')}
            hint="m"
            inputMode="decimal"
            initial={formatFieldNumber(point.mountingHeight)}
            placeholder={t('editor.notSet')}
            onCommit={(raw) =>
              commitNumber(raw, t('editor.mountingHeight'), 0, 100, (value) => ({
                mountingHeight: value,
              }))
            }
          />
          <CommitField
            key={`${point.id}-drop-${point.properties.verticalDropMeters ?? ''}`}
            label={t('editor.verticalDrop')}
            hint="m"
            inputMode="decimal"
            initial={formatFieldNumber(point.properties.verticalDropMeters)}
            placeholder={t('editor.typeDefault')}
            onCommit={(raw) =>
              commitNumber(raw, t('editor.verticalDrop'), 0, 100, (value) => {
                const { verticalDropMeters: _previous, ...rest } =
                  point.properties;

                return {
                  properties:
                    value === null ? rest : { ...rest, verticalDropMeters: value },
                };
              })
            }
          />
        </div>

        <CommitField
          key={`${point.id}-rotation-${point.rotation}`}
          label={t('editor.rotation')}
          hint={t('editor.degrees')}
          inputMode="decimal"
          initial={formatFieldNumber(point.rotation)}
          onCommit={(raw) =>
            commitNumber(raw, t('editor.rotation'), -360, 360, (value) => ({
              rotation: value ?? 0,
            }))
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <CommitField
            key={`${point.id}-x-${point.x}`}
            label={t('editor.x')}
            hint={t('editor.planUnits')}
            inputMode="decimal"
            initial={formatFieldNumber(point.x)}
            onCommit={(raw) => commitCoordinate(raw, 'x')}
          />
          <CommitField
            key={`${point.id}-y-${point.y}`}
            label={t('editor.y')}
            hint={t('editor.planUnits')}
            inputMode="decimal"
            initial={formatFieldNumber(point.y)}
            onCommit={(raw) => commitCoordinate(raw, 'y')}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t('editor.dropNote')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          {t('editor.duplicate')}
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          {t('editor.delete')}
        </Button>
      </div>
    </section>
  );
}
