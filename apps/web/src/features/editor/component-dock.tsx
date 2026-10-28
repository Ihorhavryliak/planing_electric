import { useState } from 'react';
import {
  DEVICE_SUBTYPES,
  type DeviceSubtype,
  type ElectricalPointType,
  type OpeningType,
  type RouteMounting,
} from '@drawmyplace/contracts';
import {
  Box,
  Cable,
  Circle,
  CircleDot,
  DoorOpen,
  Lightbulb,
  Plug,
  Plus,
  Shapes,
  Square,
  ToggleRight,
} from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';
import { Button } from '@/components/ui/button';

export interface OpeningSizeMeters {
  width: number;
  height: number;
  sill: number;
}

interface ComponentDockProps {
  lengthUnit: 'm' | 'cm' | 'mm';
  openingSizes: Record<OpeningType, OpeningSizeMeters>;
  canAddOpening: boolean;
  routeMounting: RouteMounting;
  onSelectDevice: (type: ElectricalPointType, subtype: DeviceSubtype) => void;
  onOpeningSizeChange: (
    type: OpeningType,
    field: keyof OpeningSizeMeters,
    meters: number,
  ) => void;
  onAddOpening: (type: OpeningType) => void;
  onRouteMountingChange: (mounting: RouteMounting) => void;
}

const DEVICE_TYPES: Array<{
  type: ElectricalPointType;
  icon: typeof Plug;
  labelKey: string;
  subtype: DeviceSubtype;
}> = [
  { type: 'socket', icon: Plug, labelKey: 'editor.point.socket', subtype: 'socket-single' },
  { type: 'switch', icon: ToggleRight, labelKey: 'editor.point.switch', subtype: 'switch-single' },
  { type: 'light', icon: Lightbulb, labelKey: 'editor.point.light', subtype: 'light-ceiling' },
  { type: 'panel', icon: Box, labelKey: 'editor.point.panel', subtype: 'sub-board' },
  { type: 'junction', icon: CircleDot, labelKey: 'editor.point.junction', subtype: 'junction-box' },
  { type: 'custom', icon: Shapes, labelKey: 'editor.point.custom', subtype: 'data-lan' },
];

const ROUTE_MOUNTS: RouteMounting[] = ['floor', 'wall', 'ceiling'];

export function ComponentDock({
  lengthUnit,
  openingSizes,
  canAddOpening,
  routeMounting,
  onSelectDevice,
  onOpeningSizeChange,
  onAddOpening,
  onRouteMountingChange,
}: ComponentDockProps) {
  const { t } = useI18n();
  const [openType, setOpenType] = useState<ElectricalPointType | null>(null);
  const [openingTab, setOpeningTab] = useState<OpeningType>('door');

  const factor = lengthUnit === 'm' ? 1 : lengthUnit === 'cm' ? 100 : 1000;
  const step = lengthUnit === 'm' ? 0.01 : lengthUnit === 'cm' ? 1 : 10;
  const size = openingSizes[openingTab];
  const routeHeightMeters =
    routeMounting === 'ceiling'
      ? 2.65
      : routeMounting === 'chase'
        ? 0.3
        : routeMounting === 'wall'
          ? 1.1
          : 0.04;
  const routeHeightLabel =
    lengthUnit === 'm'
      ? `${routeHeightMeters.toFixed(2)} m`
      : lengthUnit === 'cm'
        ? `${Math.round(routeHeightMeters * 100)} cm`
        : `${Math.round(routeHeightMeters * 1000)} mm`;
  const round = (value: number) =>
    lengthUnit === 'm'
      ? Number(value.toFixed(2))
      : Math.round(value);

  const subtypeItems = openType
    ? DEVICE_SUBTYPES.filter((item) => item.type === openType)
    : [];

  return (
    <div
      role="toolbar"
      aria-label={t('editor.dock.title')}
      data-testid="component-dock"
      className="editor-panel relative z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {t('editor.dock.devices')}
        </span>
        <div className="flex items-center gap-0.5">
          {DEVICE_TYPES.map(({ type, icon: Icon, labelKey, subtype }) => (
            <button
              key={type}
              type="button"
              title={t(labelKey)}
              aria-label={t(labelKey)}
              aria-pressed={openType === type}
              onClick={() => {
                if (openType === type) {
                  setOpenType(null);
                  return;
                }
                const items = DEVICE_SUBTYPES.filter(
                  (item) => item.type === type,
                );
                if (items.length <= 1) {
                  onSelectDevice(type, items[0]?.id ?? subtype);
                  setOpenType(null);
                  return;
                }
                setOpenType(type);
              }}
              className={`flex h-9 items-center gap-1 rounded-md px-2 text-xs transition ${
                openType === type
                  ? 'bg-[var(--dmp-color-brand)] text-[var(--dmp-color-on-brand)]'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t(labelKey)}</span>
            </button>
          ))}
        </div>
        {openType ? (
          <div className="absolute bottom-full left-3 z-40 mb-1 max-h-56 w-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur">
            <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
              {t(`editor.point.${openType}`)}
            </p>
            <div className="grid grid-cols-2 gap-0.5">
              {subtypeItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectDevice(openType, item.id);
                    setOpenType(null);
                  }}
                  className="rounded-md px-2 py-1 text-left text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {t(`devices.subtype.${item.id}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-6 w-px shrink-0 bg-white/10" aria-hidden />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {t('editor.dock.openings')}
        </span>
        <div className="flex items-center rounded-md border border-white/10 bg-slate-950/40 p-0.5">
          {(['door', 'window', 'hole'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={openingTab === type}
              onClick={() => setOpeningTab(type)}
              className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition ${
                openingTab === type
                  ? 'bg-[var(--dmp-color-brand)] text-[var(--dmp-color-on-brand)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type === 'door' ? (
                <DoorOpen className="h-3 w-3" />
              ) : type === 'hole' ? (
                <Circle className="h-3 w-3" />
              ) : (
                <Square className="h-3 w-3" />
              )}
              {t(`editor.opening.${type}`)}
            </button>
          ))}
        </div>
        {openingTab === 'hole' ? (
          <>
            <DockNumber
              key={`hole-diameter-${lengthUnit}`}
              label={t('editor.diameter')}
              unit={lengthUnit}
              value={round(size.width * factor)}
              step={step}
              onCommit={(value) =>
                onOpeningSizeChange('hole', 'width', value / factor)
              }
            />
            <DockNumber
              key={`hole-center-${lengthUnit}`}
              label={t('editor.centerHeight')}
              unit={lengthUnit}
              value={round((size.sill + size.width / 2) * factor)}
              step={step}
              onCommit={(value) =>
                onOpeningSizeChange('hole', 'sill', value / factor)
              }
            />
          </>
        ) : (
          <>
            <DockNumber
              key={`${openingTab}-width-${lengthUnit}`}
              label={t('editor.width')}
              unit={lengthUnit}
              value={round(size.width * factor)}
              step={step}
              onCommit={(value) =>
                onOpeningSizeChange(openingTab, 'width', value / factor)
              }
            />
            <DockNumber
              key={`${openingTab}-height-${lengthUnit}`}
              label={t('editor.height')}
              unit={lengthUnit}
              value={round(size.height * factor)}
              step={step}
              onCommit={(value) =>
                onOpeningSizeChange(openingTab, 'height', value / factor)
              }
            />
            {openingTab === 'window' ? (
              <DockNumber
                key={`${openingTab}-sill-${lengthUnit}`}
                label={t('editor.sill')}
                unit={lengthUnit}
                value={round(size.sill * factor)}
                step={step}
                onCommit={(value) =>
                  onOpeningSizeChange(openingTab, 'sill', value / factor)
                }
              />
            ) : null}
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canAddOpening}
          title={
            canAddOpening
              ? t('editor.dock.addOpening')
              : t('editor.dock.selectWall')
          }
          onClick={() => onAddOpening(openingTab)}
          className="h-8 gap-1 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('editor.dock.addOpening')}
        </Button>
      </div>

      <div className="h-6 w-px shrink-0 bg-white/10" aria-hidden />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <Cable className="h-3.5 w-3.5" />
          {t('editor.dock.routeLevel')}
        </span>
        <div className="flex items-center rounded-md border border-white/10 bg-slate-950/40 p-0.5">
          {ROUTE_MOUNTS.map((mounting) => (
            <button
              key={mounting}
              type="button"
              aria-pressed={routeMounting === mounting}
              onClick={() => onRouteMountingChange(mounting)}
              className={`h-7 whitespace-nowrap rounded px-1.5 text-xs transition sm:px-2 ${
                routeMounting === mounting
                  ? 'bg-[var(--dmp-color-brand)] text-[var(--dmp-color-on-brand)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t(`mounting.${mounting}`)}
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap text-[10px] text-slate-500">
          {t('editor.dock.routeHeight', { value: routeHeightLabel })}
        </span>
      </div>
    </div>
  );
}

function DockNumber({
  label,
  unit,
  value,
  step,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-500">
      {label}
      <span className="relative">
        <input
          type="number"
          min={0.01}
          step={step}
          defaultValue={value}
          onBlur={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed) && parsed > 0) onCommit(parsed);
            else event.target.value = String(value);
          }}
          className="h-7 w-[4.5rem] rounded-md border border-white/10 bg-slate-950/60 pr-6 pl-1.5 text-xs text-slate-100 tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[9px] text-slate-500">
          {unit}
        </span>
      </span>
    </label>
  );
}
