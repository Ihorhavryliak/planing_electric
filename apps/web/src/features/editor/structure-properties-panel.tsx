import type {
  PublicDimension,
  PublicRoom,
  PublicWall,
  UpdateDimensionInput,
  UpdateRoomInput,
  UpdateWallInput,
} from '@drawmyplace/contracts';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { CommitField } from './commit-field';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';
import {
  dimensionLine,
  polygonArea,
  polygonPerimeter,
  polylineLength,
} from './structure-geometry';

interface PanelProps {
  metersPerUnit: number | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100 tabular-nums">{value}</span>
    </div>
  );
}

function realLength(
  length: number,
  metersPerUnit: number | null,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatMeters: (value: number) => string,
): string {
  return metersPerUnit === null
    ? t('editor.units', { value: length.toFixed(1) })
    : formatMeters(length * metersPerUnit);
}

function realArea(
  area: number,
  metersPerUnit: number | null,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  unit: string,
): string {
  if (metersPerUnit === null) {
    return t('editor.unitsSquared', { value: area.toFixed(0) });
  }

  const squareMeters = area * metersPerUnit * metersPerUnit;
  const value = formatNumber(squareMeters, {
    minimumFractionDigits: squareMeters < 10 ? 2 : 1,
    maximumFractionDigits: squareMeters < 10 ? 2 : 1,
  });

  return `${value} ${unit}`;
}

interface WallPanelProps extends PanelProps {
  wall: PublicWall;
  onChange: (patch: UpdateWallInput) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function WallPropertiesPanel({
  wall,
  metersPerUnit,
  onChange,
  onDuplicate,
  onDelete,
}: WallPanelProps) {
  const { t, formatMeters } = useI18n();
  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('editor.wallHeading')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {t('editor.pointsCount', { count: wall.geometry.length })}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <CommitField
          key={`${wall.id}-label-${wall.label ?? ''}`}
          label={t('editor.label')}
          initial={wall.label ?? ''}
          placeholder={t('editor.northWallExample')}
          maxLength={80}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />
        <CommitField
          key={`${wall.id}-thickness-${wall.thickness ?? ''}`}
          label={t('editor.thickness')}
          hint={t('editor.planUnits')}
          inputMode="decimal"
          initial={formatFieldNumber(wall.thickness)}
          placeholder={t('editor.notSet')}
          onCommit={(raw) => {
            const parsed = parseOptionalNumber(raw, {
              label: t('editor.thickness'),
              min: 0,
              max: 100_000,
            });

            if (!parsed.ok) {
              return parsed.error;
            }

            onChange({ thickness: parsed.value });
            return null;
          }}
        />
      </div>

      <div className="mt-4 space-y-1.5 editor-subpanel p-3">
        <Row
          label={t('editor.totalLength')}
          value={realLength(
            polylineLength(wall.geometry),
            metersPerUnit,
            t,
            formatMeters,
          )}
        />
        <Row
          label={t('editor.segments')}
          value={String(wall.geometry.length - 1)}
        />
        {wall.thickness !== null && metersPerUnit !== null ? (
          <Row
            label={t('editor.thickness')}
            value={formatMeters(wall.thickness * metersPerUnit)}
          />
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t('editor.wallNote')}
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

interface RoomPanelProps extends PanelProps {
  room: PublicRoom;
  onChange: (patch: UpdateRoomInput) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function RoomPropertiesPanel({
  room,
  metersPerUnit,
  onChange,
  onDuplicate,
  onDelete,
}: RoomPanelProps) {
  const { t, formatMeters, formatNumber, formatUnit } = useI18n();
  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('editor.roomHeading')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {t('editor.pointsCount', { count: room.boundary.length })}
        </span>
      </div>

      <div className="mt-3">
        <CommitField
          key={`${room.id}-name-${room.name}`}
          label={t('editor.name')}
          initial={room.name}
          maxLength={80}
          onCommit={(raw) => {
            const name = raw.trim();

            if (name === '') {
              return t('editor.roomNameRequired');
            }

            onChange({ name });
            return null;
          }}
        />
      </div>

      <div className="mt-4 space-y-1.5 editor-subpanel p-3">
        <Row
          label={t('editor.area')}
          value={realArea(
            polygonArea(room.boundary),
            metersPerUnit,
            t,
            formatNumber,
            formatUnit('m2'),
          )}
        />
        <Row
          label={t('editor.perimeter')}
          value={realLength(
            polygonPerimeter(room.boundary),
            metersPerUnit,
            t,
            formatMeters,
          )}
        />
        <Row
          label={t('editor.corners')}
          value={String(room.boundary.length)}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t('editor.roomNote')}
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

interface DimensionPanelProps extends PanelProps {
  dimension: PublicDimension;
  onChange: (patch: UpdateDimensionInput) => void;
  onDelete: () => void;
}

export function DimensionPropertiesPanel({
  dimension,
  metersPerUnit,
  onChange,
  onDelete,
}: DimensionPanelProps) {
  const { t, formatMeters } = useI18n();
  const line = dimensionLine(
    dimension.pointA,
    dimension.pointB,
    dimension.offset,
  );

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('editor.dimensionHeading')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {t('editor.measured')}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <CommitField
          key={`${dimension.id}-label-${dimension.label ?? ''}`}
          label={t('editor.label')}
          initial={dimension.label ?? ''}
          placeholder={t('editor.windowWidthExample')}
          maxLength={80}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />
        <CommitField
          key={`${dimension.id}-offset-${dimension.offset}`}
          label={t('editor.offset')}
          hint={t('editor.planUnits')}
          inputMode="decimal"
          initial={formatFieldNumber(dimension.offset)}
          onCommit={(raw) => {
            const parsed = parseOptionalNumber(raw, {
              label: t('editor.offset'),
              min: -1_000_000,
              max: 1_000_000,
            });

            if (!parsed.ok) {
              return parsed.error;
            }

            onChange({ offset: parsed.value ?? 0 });
            return null;
          }}
        />
      </div>

      <div className="mt-4 space-y-1.5 editor-subpanel p-3">
        <Row
          label={t('editor.measured')}
          value={realLength(line.length, metersPerUnit, t, formatMeters)}
        />
        <Row
          label={t('editor.offset')}
          value={dimension.offset.toFixed(2)}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t('editor.dimensionNote')}
      </p>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        {t('editor.deleteDimension')}
      </Button>
    </section>
  );
}
