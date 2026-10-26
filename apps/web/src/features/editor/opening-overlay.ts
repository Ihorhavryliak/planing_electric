import type { EditorViewport } from '@drawmyplace/contracts';
import { worldToScreen, type CanvasSize, type Vec2 } from './editor-geometry';
import { distanceToSegment } from './route-geometry';

export interface OpeningRenderItem {
  id: string;
  wallId: string;
  type: 'door' | 'window';
  offset: number;
  width: number;
  flipped: boolean;
  label: string | null;
}

export interface WallLike {
  id: string;
  geometry: readonly Vec2[];
}

const DOOR_COLOR = '#fbbf24';
const WINDOW_COLOR = '#38bdf8';
const SELECTED_COLOR = '#f472b6';
const CUT_COLOR = '#020617';

interface PointOnWall {
  point: Vec2;
  angle: number;
}

function pointAtDistance(
  geometry: readonly Vec2[],
  distance: number,
): PointOnWall | null {
  let remaining = distance;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    if (!start || !end) continue;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= 0) continue;
    if (remaining <= length || index === geometry.length - 2) {
      const t = Math.max(0, Math.min(1, remaining / length));
      return {
        point: {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        },
        angle: Math.atan2(end.y - start.y, end.x - start.x),
      };
    }
    remaining -= length;
  }
  return null;
}

/** Id of the opening whose gap is under a screen position, or null. */
export function findOpeningAt(
  openings: readonly OpeningRenderItem[],
  walls: readonly WallLike[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 7,
): string | null {
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));
  let bestId: string | null = null;
  let best = radiusPx;

  for (const opening of openings) {
    const wall = wallById.get(opening.wallId);
    if (!wall) continue;
    const start = pointAtDistance(wall.geometry, opening.offset);
    const end = pointAtDistance(
      wall.geometry,
      opening.offset + opening.width,
    );
    if (!start || !end) continue;

    const a = worldToScreen(start.point, viewport, size);
    const b = worldToScreen(end.point, viewport, size);
    const gap = distanceToSegment(screen, a, b);

    if (gap <= best) {
      best = gap;
      bestId = opening.id;
    }
  }

  return bestId;
}

export function drawOpeningsOverlay(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  openings: readonly OpeningRenderItem[],
  walls: readonly WallLike[],
  selectedOpeningId: string | null,
): void {
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));

  for (const opening of openings) {
    const wall = wallById.get(opening.wallId);
    if (!wall) continue;

    const start = pointAtDistance(wall.geometry, opening.offset);
    const end = pointAtDistance(wall.geometry, opening.offset + opening.width);
    if (!start || !end) continue;

    const screenStart = worldToScreen(start.point, viewport, size);
    const screenEnd = worldToScreen(end.point, viewport, size);
    const selected = opening.id === selectedOpeningId;
    const color = selected
      ? SELECTED_COLOR
      : opening.type === 'door'
        ? DOOR_COLOR
        : WINDOW_COLOR;

    // Erase the wall segment so the opening reads as a gap.
    context.save();
    context.strokeStyle = CUT_COLOR;
    context.lineWidth = Math.max(8, 10 * viewport.zoom);
    context.lineCap = 'butt';
    context.beginPath();
    context.moveTo(screenStart.x, screenStart.y);
    context.lineTo(screenEnd.x, screenEnd.y);
    context.stroke();

    context.strokeStyle = color;
    context.lineWidth = selected ? 3 : 2;
    context.lineCap = 'round';

    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const pixelWidth = Math.hypot(dx, dy);
    if (pixelWidth === 0) {
      context.restore();
      continue;
    }
    const ux = dx / pixelWidth;
    const uy = dy / pixelWidth;
    const direction = opening.flipped ? -1 : 1;

    if (opening.type === 'window') {
      const nx = -uy * 4;
      const ny = ux * 4;
      context.beginPath();
      context.moveTo(screenStart.x + nx, screenStart.y + ny);
      context.lineTo(screenEnd.x + nx, screenEnd.y + ny);
      context.moveTo(screenStart.x - nx, screenStart.y - ny);
      context.lineTo(screenEnd.x - nx, screenEnd.y - ny);
      context.stroke();
    } else {
      // Door: a leaf line plus a quarter-circle swing.
      const leafX = screenStart.x - uy * pixelWidth * direction;
      const leafY = screenStart.y + ux * pixelWidth * direction;
      context.beginPath();
      context.moveTo(screenStart.x, screenStart.y);
      context.lineTo(leafX, leafY);
      context.stroke();

      const startAngle = Math.atan2(uy * direction, ux * direction);
      const endAngle = Math.atan2(
        (leafY - screenStart.y) / pixelWidth,
        (leafX - screenStart.x) / pixelWidth,
      );
      context.beginPath();
      context.arc(
        screenStart.x,
        screenStart.y,
        pixelWidth,
        Math.min(startAngle, endAngle),
        Math.max(startAngle, endAngle),
      );
      context.stroke();
    }

    if (opening.label) {
      const midX = (screenStart.x + screenEnd.x) / 2;
      const midY = (screenStart.y + screenEnd.y) / 2;
      context.fillStyle = color;
      context.font = '11px Inter, sans-serif';
      context.textAlign = 'center';
      context.fillText(opening.label, midX, midY - 8);
    }

    context.restore();
  }
}
