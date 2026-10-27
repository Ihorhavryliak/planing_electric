import type { EditorViewport } from '@drawmyplace/contracts';
import {
  distanceBetween,
  formatMeters,
  worldToScreen,
  type CanvasSize,
  type Vec2,
} from './editor-geometry';
import {
  dimensionLine,
  polygonArea,
  polygonCentroid,
  polylineLength,
} from './structure-geometry';

export interface WallRenderItem {
  id: string;
  geometry: readonly Vec2[];
  thickness: number | null;
  label: string | null;
}

export interface RoomRenderItem {
  id: string;
  name: string;
  boundary: readonly Vec2[];
}

export interface DimensionRenderItem {
  id: string;
  pointA: Vec2;
  pointB: Vec2;
  offset: number;
  label: string | null;
}

export type StructureDraftKind = 'wall' | 'room' | 'dimension';

export interface StructureDraft {
  kind: StructureDraftKind;
  points: readonly Vec2[];
}

const WALL_COLOR = '#cbd5e1';
const SELECTED_COLOR = '#fbbf24';
const ROOM_FILL = 'rgba(45, 212, 191, 0.08)';
const ROOM_SELECTED_FILL = 'rgba(251, 191, 36, 0.1)';
const ROOM_STROKE = 'rgba(45, 212, 191, 0.55)';
const DIMENSION_COLOR = '#94a3b8';

let structureLight = false;

function traceClosed(
  context: CanvasRenderingContext2D,
  path: readonly Vec2[],
): void {
  context.beginPath();

  path.forEach((vertex, index) => {
    if (index === 0) {
      context.moveTo(vertex.x, vertex.y);
    } else {
      context.lineTo(vertex.x, vertex.y);
    }
  });

  context.closePath();
}

function drawHandles(
  context: CanvasRenderingContext2D,
  path: readonly Vec2[],
): void {
  for (const vertex of path) {
    context.beginPath();
    context.rect(vertex.x - 4.5, vertex.y - 4.5, 9, 9);
    context.fillStyle = structureLight ? '#ffffff' : '#020617';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = structureLight ? '#2f6bd8' : SELECTED_COLOR;
    context.stroke();
  }
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  at: Vec2,
  color: string,
  weight = '500',
): void {
  context.font = `${weight} 11px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const padding = 3;
  const width = context.measureText(text).width + padding * 2;

  context.fillStyle = structureLight
    ? 'rgba(255, 255, 255, 0.94)'
    : 'rgba(2, 6, 23, 0.82)';
  context.fillRect(at.x - width / 2, at.y - 8, width, 16);
  context.fillStyle = structureLight && color === '#e2e8f0' ? '#434c55' : color;
  context.fillText(text, at.x, at.y + 0.5);
}

function lengthLabel(length: number, metersPerUnit: number | null): string {
  return metersPerUnit === null
    ? `${length.toFixed(1)} units`
    : formatMeters(length * metersPerUnit);
}

function areaLabel(area: number, metersPerUnit: number | null): string {
  if (metersPerUnit === null) {
    return `${area.toFixed(0)} units²`;
  }

  const squareMeters = area * metersPerUnit * metersPerUnit;

  return squareMeters < 10
    ? `${squareMeters.toFixed(2)} m²`
    : `${squareMeters.toFixed(1)} m²`;
}

/**
 * Draws room fills, wall polylines, dimension lines and the active draft.
 * Geometry inputs are world coordinates; labels are rendered in screen space.
 */
export function drawStructureOverlay(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  walls: readonly WallRenderItem[],
  rooms: readonly RoomRenderItem[],
  dimensions: readonly DimensionRenderItem[],
  selectedWallId: string | null,
  selectedRoomId: string | null,
  selectedDimensionId: string | null,
  draft: StructureDraft | null,
  cursor: Vec2 | null,
  metersPerUnit: number | null,
  light = false,
): void {
  structureLight = light;
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const room of rooms) {
    const path = room.boundary.map((vertex) =>
      worldToScreen(vertex, viewport, size),
    );
    const selected = room.id === selectedRoomId;
    const center = worldToScreen(
      polygonCentroid(room.boundary),
      viewport,
      size,
    );

    traceClosed(context, path);
    context.fillStyle = light
      ? selected
        ? 'rgba(47, 107, 216, 0.09)'
        : 'rgba(47, 107, 216, 0.035)'
      : selected
        ? ROOM_SELECTED_FILL
        : ROOM_FILL;
    context.fill();
    context.lineWidth = selected ? 3 : 2;
    context.strokeStyle = light
      ? selected
        ? '#2f6bd8'
        : 'rgba(47, 107, 216, 0.4)'
      : selected
        ? SELECTED_COLOR
        : ROOM_STROKE;
    context.stroke();

    drawText(context, room.name, { x: center.x, y: center.y - 7 }, light ? '#1c2229' : '#ccfbf1', '600');
    drawText(
      context,
      areaLabel(polygonArea(room.boundary), metersPerUnit),
      { x: center.x, y: center.y + 10 },
      light ? '#2f6bd8' : '#5eead4',
    );

    if (selected) {
      drawHandles(context, path);
    }
  }

  for (const wall of walls) {
    const path = wall.geometry.map((vertex) =>
      worldToScreen(vertex, viewport, size),
    );
    const selected = wall.id === selectedWallId;
    const thicknessPx =
      wall.thickness !== null && wall.thickness > 0
        ? Math.min(48, Math.max(2, wall.thickness * viewport.zoom))
        : null;

    if (thicknessPx !== null) {
      context.beginPath();
      path.forEach((vertex, index) => {
        if (index === 0) {
          context.moveTo(vertex.x, vertex.y);
        } else {
          context.lineTo(vertex.x, vertex.y);
        }
      });
      context.lineWidth = thicknessPx;
      context.strokeStyle = selected
        ? light
          ? 'rgba(47, 107, 216, 0.18)'
          : 'rgba(251, 191, 36, 0.28)'
        : light
          ? 'rgba(63, 74, 86, 0.08)'
          : 'rgba(203, 213, 225, 0.16)';
      context.stroke();
    }

    context.beginPath();
    path.forEach((vertex, index) => {
      if (index === 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.lineWidth = selected ? 3.5 : 2.5;
    context.strokeStyle = selected
      ? light
        ? '#2f6bd8'
        : SELECTED_COLOR
      : light
        ? '#3f4a56'
        : WALL_COLOR;
    context.stroke();

    if (wall.label || selected) {
      const middle = path[Math.floor(path.length / 2)];
      const anchor = middle ?? path[0];

      if (anchor) {
        drawText(
          context,
          wall.label
            ? `${wall.label} · ${lengthLabel(
                polylineLength(wall.geometry),
                metersPerUnit,
              )}`
            : lengthLabel(polylineLength(wall.geometry), metersPerUnit),
          { x: anchor.x, y: anchor.y - 14 },
          selected ? (light ? '#2f6bd8' : SELECTED_COLOR) : light ? '#434c55' : '#e2e8f0',
        );
      }
    }

    if (selected) {
      drawHandles(context, path);
    }
  }

  for (const dimension of dimensions) {
    const selected = dimension.id === selectedDimensionId;
    const line = dimensionLine(
      dimension.pointA,
      dimension.pointB,
      dimension.offset,
    );
    const a = worldToScreen(dimension.pointA, viewport, size);
    const b = worldToScreen(dimension.pointB, viewport, size);
    const start = worldToScreen(line.start, viewport, size);
    const end = worldToScreen(line.end, viewport, size);
    const color = selected
      ? light
        ? '#2f6bd8'
        : SELECTED_COLOR
      : light
        ? '#5a636c'
        : DIMENSION_COLOR;

    context.setLineDash([4, 4]);
    context.lineWidth = 1;
    context.strokeStyle = light
      ? 'rgba(90, 99, 108, 0.35)'
      : 'rgba(148, 163, 184, 0.4)';
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(start.x, start.y);
    context.moveTo(b.x, b.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.setLineDash([]);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.lineWidth = selected ? 2.5 : 1.5;
    context.strokeStyle = color;
    context.stroke();

    // Short diagonal ticks mark the measured ends.
    const tick = 5;

    for (const point of [start, end]) {
      context.beginPath();
      context.moveTo(point.x - tick, point.y + tick);
      context.lineTo(point.x + tick, point.y - tick);
      context.lineWidth = 1.5;
      context.stroke();
    }

    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const measured = lengthLabel(line.length, metersPerUnit);

    drawText(
      context,
      dimension.label ? `${dimension.label} · ${measured}` : measured,
      middle,
      selected ? (light ? '#2f6bd8' : SELECTED_COLOR) : light ? '#5a636c' : '#cbd5e1',
    );

    if (selected) {
      drawHandles(context, [start, end]);
    }
  }

  if (draft && draft.points.length > 0) {
    const path = draft.points.map((vertex) =>
      worldToScreen(vertex, viewport, size),
    );
    const color =
      draft.kind === 'wall'
        ? light
          ? '#3f4a56'
          : WALL_COLOR
        : draft.kind === 'room'
          ? light
            ? '#2f6bd8'
            : '#5eead4'
          : light
            ? '#5a636c'
            : DIMENSION_COLOR;

    if (draft.kind === 'room' && path.length >= 2) {
      traceClosed(context, path);
      context.fillStyle = light
        ? 'rgba(47, 107, 216, 0.035)'
        : ROOM_FILL;
      context.fill();
    }

    context.beginPath();
    path.forEach((vertex, index) => {
      if (index === 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.lineWidth = 2;
    context.strokeStyle = color;
    context.stroke();

    const last = path[path.length - 1];

    if (last && cursor) {
      const end = worldToScreen(cursor, viewport, size);

      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(last.x, last.y);
      context.lineTo(end.x, end.y);

      if (draft.kind === 'room' && path[0]) {
        context.lineTo(path[0].x, path[0].y);
      }

      context.stroke();
      context.setLineDash([]);
    }

    for (const vertex of path) {
      context.beginPath();
      context.arc(vertex.x, vertex.y, 3.5, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    }

    if (draft.kind === 'dimension' && draft.points[0] && cursor) {
      const measured = distanceBetween(draft.points[0], cursor);
      const start = path[0];
      const end = worldToScreen(cursor, viewport, size);

      if (start) {
        drawText(
          context,
          lengthLabel(measured, metersPerUnit),
          { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 12 },
          color,
        );
      }
    }
  }

  context.restore();
}
