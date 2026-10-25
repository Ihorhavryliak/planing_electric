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
import { CommitField } from './commit-field';
import { formatMeters } from './editor-geometry';
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

function realLength(length: number, metersPerUnit: number | null): string {
  return metersPerUnit === null
    ? `${length.toFixed(1)} units`
    : formatMeters(length * metersPerUnit);
}

function realArea(area: number, metersPerUnit: number | null): string {
  if (metersPerUnit === null) {
    return `${area.toFixed(0)} units²`;
  }

  const squareMeters = area * metersPerUnit * metersPerUnit;

  return squareMeters < 10
    ? `${squareMeters.toFixed(2)} m²`
    : `${squareMeters.toFixed(1)} m²`;
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
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Wall</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {wall.geometry.length} points
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <CommitField
          key={`${wall.id}-label-${wall.label ?? ''}`}
          label="Label"
          initial={wall.label ?? ''}
          placeholder="e.g. North wall"
          maxLength={80}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />
        <CommitField
          key={`${wall.id}-thickness-${wall.thickness ?? ''}`}
          label="Thickness"
          hint="plan units"
          inputMode="decimal"
          initial={formatFieldNumber(wall.thickness)}
          placeholder="not set"
          onCommit={(raw) => {
            const parsed = parseOptionalNumber(raw, {
              label: 'Thickness',
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

      <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Row
          label="Total length"
          value={realLength(polylineLength(wall.geometry), metersPerUnit)}
        />
        <Row label="Segments" value={String(wall.geometry.length - 1)} />
        {wall.thickness !== null && metersPerUnit !== null ? (
          <Row
            label="Thickness"
            value={formatMeters(wall.thickness * metersPerUnit)}
          />
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Drag a square handle to move a corner, or drag the wall body to move the
        whole wall. Thickness is drawn in plan units.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
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
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Room</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          {room.boundary.length} points
        </span>
      </div>

      <div className="mt-3">
        <CommitField
          key={`${room.id}-name-${room.name}`}
          label="Name"
          initial={room.name}
          maxLength={80}
          onCommit={(raw) => {
            const name = raw.trim();

            if (name === '') {
              return 'Room name is required.';
            }

            onChange({ name });
            return null;
          }}
        />
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Row
          label="Area"
          value={realArea(polygonArea(room.boundary), metersPerUnit)}
        />
        <Row
          label="Perimeter"
          value={realLength(polygonPerimeter(room.boundary), metersPerUnit)}
        />
        <Row label="Corners" value={String(room.boundary.length)} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Drag a square handle to move a corner, or drag the room body to move the
        whole room. Area is computed from the boundary.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
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
  const line = dimensionLine(
    dimension.pointA,
    dimension.pointB,
    dimension.offset,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Dimension</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
          measured
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <CommitField
          key={`${dimension.id}-label-${dimension.label ?? ''}`}
          label="Label"
          initial={dimension.label ?? ''}
          placeholder="e.g. Window width"
          maxLength={80}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />
        <CommitField
          key={`${dimension.id}-offset-${dimension.offset}`}
          label="Offset"
          hint="plan units"
          inputMode="decimal"
          initial={formatFieldNumber(dimension.offset)}
          onCommit={(raw) => {
            const parsed = parseOptionalNumber(raw, {
              label: 'Offset',
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

      <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Row
          label="Measured"
          value={realLength(line.length, metersPerUnit)}
        />
        <Row label="Offset" value={dimension.offset.toFixed(2)} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Drag the dimension line to change its offset. The measured distance
        always follows the two anchor points.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        Delete dimension
      </Button>
    </section>
  );
}
