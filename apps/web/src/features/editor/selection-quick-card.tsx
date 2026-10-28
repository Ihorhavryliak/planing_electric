import { useEffect, useState } from 'react';
import type { PublicPoint, UpdatePointInput } from '@drawmyplace/contracts';
import { Lock, Unlock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';

interface SelectionQuickCardProps {
  point: PublicPoint;
  lengthUnit?: 'm' | 'cm' | 'mm';
  anchor: { x: number; y: number };
  bounds: { width: number; height: number };
  onClose: () => void;
  onPatchPoint?: (id: string, patch: UpdatePointInput) => void;
  onTogglePointLock?: (id: string, locked: boolean) => void;
  onLengthUnitChange?: (unit: 'm' | 'cm' | 'mm') => void;
}

function defaultHeightMeters(point: PublicPoint): number {
  if (point.type === 'socket') return 0.3;
  if (point.type === 'switch') return 1.1;
  if (point.type === 'light') return 2.4;
  if (point.type === 'panel') return 1.5;
  if (point.type === 'junction') return 0.3;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MOUNT_PRESETS = [
  { id: 'floor', meters: 0.3 },
  { id: 'wall', meters: 1.1 },
  { id: 'ceiling', meters: 2.4 },
] as const;

export function SelectionQuickCard({
  point,
  lengthUnit = 'm',
  anchor,
  bounds,
  onClose,
  onPatchPoint,
  onTogglePointLock,
  onLengthUnitChange,
}: SelectionQuickCardProps) {
  const { t } = useI18n();
  const factor = lengthUnit === 'm' ? 1 : lengthUnit === 'cm' ? 100 : 1000;
  const [label, setLabel] = useState(point.label ?? '');
  const [height, setHeight] = useState('');
  const [x, setX] = useState('');
  const [y, setY] = useState('');

  useEffect(() => {
    setLabel(point.label ?? '');
    setX(String(Number(point.x.toFixed(2))));
    setY(String(Number(point.y.toFixed(2))));
    const meters = point.mountingHeight ?? defaultHeightMeters(point);
    setHeight(
      String(
        lengthUnit === 'm'
          ? Number(meters.toFixed(2))
          : Math.round(meters * factor),
      ),
    );
  }, [point, factor, lengthUnit]);

  const width = 300;
  const cardHeight = 430;
  const margin = 10;
  let left = anchor.x + 24;
  if (left + width > bounds.width - margin) {
    left = anchor.x - width - 24;
  }
  left = clamp(
    left,
    margin,
    Math.max(margin, bounds.width - width - margin),
  );
  const preferredTop = anchor.y - cardHeight - 24;
  const top = clamp(
    preferredTop >= margin ? preferredTop : anchor.y + 24,
    margin,
    Math.max(margin, bounds.height - cardHeight - margin),
  );

  if (bounds.width < 20 || bounds.height < 20) return null;
  if (anchor.x < 0 || anchor.y < 0) return null;
  if (anchor.x > bounds.width || anchor.y > bounds.height) return null;

  const commitLabel = () => {
    if (!onPatchPoint) return;
    const next = label.trim();
    if (next === (point.label ?? '')) return;
    onPatchPoint(point.id, { label: next || null });
  };

  const commitHeight = (value = height) => {
    if (!onPatchPoint) return;
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onPatchPoint(point.id, { mountingHeight: parsed / factor });
  };

  const commitCoordinate = (axis: 'x' | 'y', value: string) => {
    if (!onPatchPoint) return;
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const current = axis === 'x' ? point.x : point.y;
    if (Math.abs(parsed - current) < 1e-6) return;
    onPatchPoint(point.id, axis === 'x' ? { x: parsed } : { y: parsed });
  };

  const locked = Boolean(
    (point.properties as { locked?: boolean }).locked,
  );
  const currentHeightMeters =
    point.mountingHeight ?? defaultHeightMeters(point);
  const activeMount =
    currentHeightMeters <= 0.45
      ? 'floor'
      : currentHeightMeters >= 2.2
        ? 'ceiling'
        : 'wall';

  return (
    <div
      role="group"
      aria-label={t(`editor.point.${point.type}`)}
      className="absolute z-40 w-[300px] rounded-xl border border-border bg-card/95 p-3 text-xs text-card-foreground shadow-xl backdrop-blur"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {t(`editor.point.${point.type}`)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t('editor.quickEdit')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-border p-0.5">
            {(['m', 'cm', 'mm'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => onLengthUnitChange?.(unit)}
                aria-pressed={lengthUnit === unit}
                className={`rounded px-1 py-0.5 text-[9px] transition ${
                  lengthUnit === unit
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={t('editor.close')}
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <label className="mt-2 block text-[11px] text-muted-foreground">
        {t('editor.label')}
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          maxLength={60}
          className="mt-1 h-8 text-xs"
          placeholder={t('editor.labelPlaceholder')}
        />
      </label>

      <div className="mt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('editor.section.position')}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <label className="text-[10px] text-muted-foreground">
            X
            <Input
              value={x}
              onChange={(event) => setX(event.target.value)}
              onBlur={() => commitCoordinate('x', x)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-0.5 h-7 text-xs"
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            Y
            <Input
              value={y}
              onChange={(event) => setY(event.target.value)}
              onBlur={() => commitCoordinate('y', y)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="mt-0.5 h-7 text-xs"
            />
          </label>
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {t('editor.planUnits')}
        </p>
      </div>

      <div className="mt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('editor.pointDetails.mounting')}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {MOUNT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const value =
                  lengthUnit === 'm'
                    ? String(preset.meters)
                    : String(Math.round(preset.meters * factor));
                setHeight(value);
                commitHeight(value);
              }}
              aria-pressed={activeMount === preset.id}
              className={`h-7 rounded-md border text-[10px] transition ${
                activeMount === preset.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {t(`mounting.${preset.id}`)}
            </button>
          ))}
        </div>
        <label className="mt-1 block text-[10px] text-muted-foreground">
          {t('editor.heightFromFloor')}
          <span className="relative mt-0.5 block">
            <Input
              type="number"
              min="0"
              step={lengthUnit === 'm' ? 0.01 : 1}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              onBlur={() => commitHeight()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="h-7 pr-8 text-xs"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-muted-foreground">
              {lengthUnit}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-2 flex justify-end border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[10px]"
          onClick={() => onTogglePointLock?.(point.id, !locked)}
        >
          {locked ? (
            <Unlock className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {locked ? t('editor.unlockPoint') : t('editor.lockPoint')}
        </Button>
      </div>
    </div>
  );
}
