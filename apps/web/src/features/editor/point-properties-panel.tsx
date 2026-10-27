import {
  DEVICE_SUBTYPES,
  deviceProduct,
  deviceProductsForSubtype,
  type Circuit,
  type DeviceSubtype,
  type ElectricalPointType,
  type PublicPoint,
  type SignalingLoop,
  type UpdatePointInput,
} from '@drawmyplace/contracts';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { CommitField } from './commit-field';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';
import { POINT_SYMBOL_LIST, POINT_SYMBOLS } from './point-symbols';
import { SIGNALING_SUBTYPES } from './signaling';

interface PointPropertiesPanelProps {
  point: PublicPoint;
  circuits?: readonly Circuit[];
  signalingLoops?: readonly SignalingLoop[];
  onChange: (patch: UpdatePointInput) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PointPropertiesPanel({
  point,
  circuits = [],
  signalingLoops = [],
  onChange,
  onDuplicate,
  onDelete,
}: PointPropertiesPanelProps) {
  const { t } = useI18n();
  const symbol = POINT_SYMBOLS[point.type];
  const subtypeOptions = DEVICE_SUBTYPES.filter(
    (definition) => definition.type === point.type,
  );
  const currentProduct = deviceProduct(point.properties.productId);
  const productOptions = point.properties.subtype
    ? deviceProductsForSubtype(point.properties.subtype)
    : [];
  const products =
    currentProduct && !productOptions.some((item) => item.id === currentProduct.id)
      ? [currentProduct, ...productOptions]
      : productOptions;

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
              const value = event.target.value || null;
              const nextSubtype = value as DeviceSubtype | null;
              const keepProduct =
                currentProduct && currentProduct.subtype === nextSubtype
                  ? currentProduct
                  : null;
              const { subtype: _previous, productId: _article, ...rest } =
                point.properties;
              onChange({
                properties: {
                  ...rest,
                  ...(nextSubtype ? { subtype: nextSubtype } : {}),
                  ...(keepProduct ? { productId: keepProduct.id } : {}),
                },
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
            {t('library.article')}
          </span>
          <select
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            value={point.properties.productId ?? ''}
            onChange={(event) => {
              const selected = deviceProduct(event.target.value || null);
              const { productId: _previous, ...rest } = point.properties;
              onChange({
                properties: selected
                  ? {
                      ...rest,
                      productId: selected.id,
                      subtype: selected.subtype,
                    }
                  : rest,
              });
            }}
          >
            <option value="">{t('library.noArticle')}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.manufacturer} · {product.article} · {product.name}
              </option>
            ))}
          </select>
          {currentProduct ? (
            <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
              {currentProduct.rating} · {currentProduct.standard}
            </span>
          ) : point.properties.subtype ? (
            <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
              {t('library.noProducts')}
            </span>
          ) : null}
        </label>

        {signalingLoops.length > 0 ||
        (point.properties.subtype &&
          SIGNALING_SUBTYPES.has(point.properties.subtype)) ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--dmp-color-brand)]">
              {t('signaling.loop')}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2 block text-xs text-slate-400">
                {t('signaling.loop')}
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100"
                  value={point.properties.loopId ?? ''}
                  onChange={(event) => {
                    const { loopId: _previous, ...rest } = point.properties;
                    onChange({
                      properties: event.target.value
                        ? { ...rest, loopId: event.target.value }
                        : rest,
                    });
                  }}
                >
                  <option value="">{t('signaling.noLoop')}</option>
                  {signalingLoops.map((loop) => (
                    <option key={loop.id} value={loop.id}>
                      {loop.code} · {loop.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                {t('signaling.address')}
                <input
                  type="number"
                  min="0"
                  max="9999"
                  defaultValue={point.properties.address ?? ''}
                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100"
                  onBlur={(event) => {
                    const value =
                      event.target.value === ''
                        ? null
                        : Math.max(0, Math.min(9999, Number(event.target.value) || 0));
                    const { address: _previous, ...rest } = point.properties;
                    onChange({
                      properties:
                        value === null ? rest : { ...rest, address: value },
                    });
                  }}
                />
              </label>
              <label className="block text-xs text-slate-400">
                {t('signaling.point.zone')}
                <input
                  type="number"
                  min="0"
                  max="999"
                  defaultValue={point.properties.zone ?? ''}
                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100"
                  onBlur={(event) => {
                    const value =
                      event.target.value === ''
                        ? null
                        : Math.max(0, Math.min(999, Number(event.target.value) || 0));
                    const { zone: _previous, ...rest } = point.properties;
                    onChange({
                      properties:
                        value === null ? rest : { ...rest, zone: value },
                    });
                  }}
                />
              </label>
            </div>
            {currentProduct && point.properties.loopId ? (
              <p className="mt-2 text-[10px] text-slate-500">
                {t('signaling.compatibility', {
                  status: t(
                    currentProduct.loopAddressable
                      ? 'signaling.compatible'
                      : 'signaling.incompatible',
                  ),
                })}
              </p>
            ) : null}
          </div>
        ) : null}

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

        <details open className="group rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
            {t('editor.section.position')}
            <span className="text-slate-500 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 space-y-3">
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
        </details>
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
