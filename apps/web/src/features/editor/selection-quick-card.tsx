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

export function SelectionQuickCard({
  point,
  lengthUnit = 'm',
  anchor,
  bounds,
  onClose,
  onPatchPoint,
  onTogglePointLock,
}: SelectionQuickCardProps) {
  const { t } = useI18n();
  const factor = lengthUnit === 'm' ? 1 : lengthUnit === 'cm' ? 100 : 1000;
  const [label, setLabel] = useState(point.label ?? '');
  const [height, setHeight] = useState('');

  useEffect(() => {
    setLabel(point.label ?? '');
    const meters = point.mountingHeight ?? defaultHeightMeters(point);
    setHeight(
      String(
        lengthUnit === 'm'
          ? Number(meters.toFixed(2))
          : Math.round(meters * factor),
      ),
    );
  }, [point, factor, lengthUnit]);

  const width = 260;
  const cardHeight = 206;
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

  const commitHeight = () => {
    if (!onPatchPoint) return;
    const parsed = Number(height.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onPatchPoint(point.id, { mountingHeight: parsed / factor });
  };

  const locked = Boolean(
    (point.properties as { locked?: boolean }).locked,
  );
  return (
    <div
      role="group"
      aria-label={t(`editor.point.${point.type}`)}
      className="absolute z-40 w-[260px] rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {t(`editor.point.${point.type}`)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {t('editor.quickEdit')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('editor.close')}
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-[11px] text-slate-400">
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
        <label className="block text-[11px] text-slate-400">
          {t('editor.heightFromFloor')}
          <span className="relative mt-1 block">
            <Input
              type="number"
              min="0"
              step={lengthUnit === 'm' ? 0.01 : 1}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              onBlur={commitHeight}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="h-8 pr-9 text-xs"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-slate-500">
              {lengthUnit}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-2 flex justify-end border-t border-white/10 pt-2">
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
