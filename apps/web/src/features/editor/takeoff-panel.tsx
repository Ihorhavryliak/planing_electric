import type { TakeoffSummary } from '@drawmyplace/calculations';
import { CheckCircle2, CircleSlash } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';

interface TakeoffPanelProps {
  summary: TakeoffSummary;
  wallHeightMeters: number;
  defaultThicknessMeters: number;
  onWallHeightChange: (value: number) => void;
  onDefaultThicknessChange: (value: number) => void;
  onSelectCircuit?: (circuitId: string | null) => void;
  /** Load summary from the live electrical calculation. */
  electrical?: {
    installedKw: number;
    demandKw: number;
    currentA: number;
    calibrated: boolean;
  } | null;
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className={strong ? 'text-slate-300' : 'text-slate-400'}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? 'font-semibold text-white' : 'font-medium text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 editor-subpanel p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

/**
 * Quantities that update with the drawing. It deliberately does not create an
 * estimate: it is a fast design check for walls, rooms, devices and cable.
 */
export function TakeoffPanel({
  summary,
  wallHeightMeters,
  defaultThicknessMeters,
  onWallHeightChange,
  onDefaultThicknessChange,
  onSelectCircuit,
  electrical,
}: TakeoffPanelProps) {
  const { t, formatMeters, formatNumber, formatCurrency } = useI18n();
  const area = (value: number) =>
    `${formatNumber(value, { maximumFractionDigits: 2 })} m²`;
  const volume = (value: number) =>
    `${formatNumber(value, { maximumFractionDigits: 3 })} m³`;
  const deviceTypes = Object.entries(summary.deviceCounts).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  const subtypes = Object.entries(summary.subtypeCounts).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('takeoff.title')}
        </h2>
        <span
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
            summary.calibrated
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
          }`}
        >
          {summary.calibrated ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <CircleSlash className="h-3 w-3" />
          )}
          {summary.calibrated
            ? t('takeoff.calibrated')
            : t('takeoff.uncalibratedBadge')}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('takeoff.hint')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="text-slate-400">{t('takeoff.wallHeight')}</span>
          <input
            type="number"
            min={2}
            max={6}
            step={0.1}
            value={wallHeightMeters}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onWallHeightChange(value);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          />
        </label>
        <label className="block text-xs">
          <span className="text-slate-400">
            {t('takeoff.defaultThickness')}
          </span>
          <input
            type="number"
            min={0.05}
            max={0.5}
            step={0.01}
            value={defaultThicknessMeters}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onDefaultThicknessChange(value);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          />
        </label>
      </div>

      {summary.calibrated ? null : (
        <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          {t('takeoff.uncalibrated')}
        </p>
      )}

      <Group title={t('takeoff.walls')}>
        <Row
          label={t('takeoff.wallLength')}
          value={
            summary.wallLengthMeters === null
              ? '—'
              : formatMeters(summary.wallLengthMeters)
          }
          strong
        />
        <Row label={t('takeoff.wallNodes')} value={String(summary.wallNodes)} />
        <Row label={t('takeoff.wallCount')} value={String(summary.wallCount)} />
        <Row
          label={t('takeoff.grossArea')}
          value={
            summary.grossWallAreaM2 === null
              ? '—'
              : area(summary.grossWallAreaM2)
          }
        />
        <Row
          label={t('takeoff.openingArea')}
          value={
            summary.openingAreaM2 === null ? '—' : area(summary.openingAreaM2)
          }
        />
        <Row
          label={t('takeoff.netArea')}
          value={
            summary.netWallAreaM2 === null ? '—' : area(summary.netWallAreaM2)
          }
        />
        <Row
          label={t('takeoff.volume')}
          value={
            summary.wallVolumeM3 === null ? '—' : volume(summary.wallVolumeM3)
          }
        />
      </Group>

      <Group title={t('takeoff.rooms')}>
        <Row
          label={t('takeoff.roomArea')}
          value={summary.roomAreaM2 === null ? '—' : area(summary.roomAreaM2)}
          strong
        />
        <Row
          label={t('takeoff.roomPerimeter')}
          value={
            summary.roomPerimeterMeters === null
              ? '—'
              : formatMeters(summary.roomPerimeterMeters)
          }
        />
      </Group>

      {electrical ? (
        <Group title={t('takeoff.electricalLoad')}>
          <Row
            label={t('takeoff.installedPower')}
            value={`${formatNumber(electrical.installedKw, {
              maximumFractionDigits: 2,
            })} kW`}
          />
          <Row
            label={t('takeoff.demandPower')}
            value={`${formatNumber(electrical.demandKw, {
              maximumFractionDigits: 2,
            })} kW`}
          />
          <Row
            label={t('takeoff.designCurrent')}
            value={
              electrical.calibrated
                ? `${formatNumber(electrical.currentA, {
                    maximumFractionDigits: 1,
                  })} A`
                : '—'
            }
            strong
          />
        </Group>
      ) : null}

      <Group title={t('takeoff.devices')}>
        <Row
          label={t('takeoff.totalDevices')}
          value={String(summary.totalDevices)}
          strong
        />
        {deviceTypes.map(([type, count]) => (
          <Row
            key={type}
            label={t(`editor.point.${type}`)}
            value={String(count)}
          />
        ))}
        {subtypes.length > 0 ? (
          <details className="pt-1">
            <summary className="cursor-pointer text-[11px] text-slate-500">
              {t('takeoff.bySubtype')}
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {subtypes.map(([subtype, count]) => (
                <Row
                  key={subtype}
                  label={t(`devices.subtype.${subtype}`)}
                  value={String(count)}
                />
              ))}
            </div>
          </details>
        ) : null}
      </Group>

      <Group title={t('takeoff.cable')}>
        <Row
          label={t('takeoff.cableTotal')}
          value={
            summary.totalCableMeters === null
              ? '—'
              : formatMeters(summary.totalCableMeters)
          }
          strong
        />
        {summary.cableCost !== null ? (
          <Row
            label={t('takeoff.cableCost')}
            value={formatCurrency(summary.cableCost)}
          />
        ) : null}
        {summary.cableByCircuit.length > 0 ? (
          <div className="space-y-1 border-t border-white/10 pt-1.5">
            {summary.cableByCircuit.map((entry) => (
              <button
                key={entry.circuitId ?? 'unassigned'}
                type="button"
                disabled={!onSelectCircuit}
                onClick={() => onSelectCircuit?.(entry.circuitId)}
                className="flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-xs text-slate-400 enabled:hover:bg-white/5 enabled:hover:text-slate-200"
              >
                <span className="truncate">
                  {entry.circuitId ?? t('takeoff.unassigned')}
                </span>
                <span className="tabular-nums text-slate-200">
                  {formatMeters(entry.meters)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </Group>
    </section>
  );
}
