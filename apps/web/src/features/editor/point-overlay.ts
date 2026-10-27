import type { EditorViewport, ElectricalPointType } from '@drawmyplace/contracts';
import { worldToScreen, type CanvasSize, type Vec2 } from './editor-geometry';
import { POINT_SYMBOLS } from './point-symbols';

export interface PointRenderItem {
  id: string;
  type: ElectricalPointType;
  x: number;
  y: number;
  rotation: number;
  label: string | null;
}

export interface PointGhost {
  type: ElectricalPointType;
  at: Vec2;
}

/** Symbols are schematic: a constant size in screen pixels, not to scale. */
const RADIUS = 9;
const BACKGROUND = '#020617';

let pointLight = false;

type Painter = (context: CanvasRenderingContext2D, color: string) => void;

function circle(context: CanvasRenderingContext2D, color: string): void {
  context.beginPath();
  context.arc(0, 0, RADIUS, 0, Math.PI * 2);
  context.fillStyle = pointLight ? '#ffffff' : BACKGROUND;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = color;
  context.stroke();
}

function line(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

/** Exhaustive over the point types, so a new type cannot be forgotten. */
const PAINTERS: Readonly<Record<ElectricalPointType, Painter>> = {
  socket: (context, color) => {
    circle(context, color);
    line(context, 0, -RADIUS + 3, 0, RADIUS - 3);
  },
  switch: (context, color) => {
    circle(context, color);
    line(context, 0, 0, RADIUS + 5, -RADIUS - 2);
  },
  light: (context, color) => {
    circle(context, color);
    const d = RADIUS * 0.6;
    line(context, -d, -d, d, d);
    line(context, -d, d, d, -d);
  },
  panel: (context, color) => {
    context.fillStyle = color;
    context.fillRect(-RADIUS - 2, -RADIUS + 1, (RADIUS + 2) * 2, (RADIUS - 1) * 2);
    context.lineWidth = 2;
    context.strokeStyle = BACKGROUND;
    line(context, -RADIUS + 2, -3, RADIUS - 2, -3);
    line(context, -RADIUS + 2, 3, RADIUS - 2, 3);
  },
  junction: (context, color) => {
    circle(context, color);
    context.beginPath();
    context.arc(0, 0, 3, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  },
  custom: (context, color) => {
    context.beginPath();
    context.moveTo(0, -RADIUS - 1);
    context.lineTo(RADIUS + 1, 0);
    context.lineTo(0, RADIUS + 1);
    context.lineTo(-RADIUS - 1, 0);
    context.closePath();
    context.fillStyle = BACKGROUND;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = color;
    context.stroke();
  },
};

function drawSymbol(
  context: CanvasRenderingContext2D,
  type: ElectricalPointType,
  at: Vec2,
  rotation: number,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.translate(at.x, at.y);
  context.rotate((rotation * Math.PI) / 180);
  context.lineCap = 'round';
  PAINTERS[type](context, POINT_SYMBOLS[type].color);
  context.restore();
}

function drawPointLabel(
  context: CanvasRenderingContext2D,
  text: string,
  at: Vec2,
): void {
  context.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';

  const width = context.measureText(text).width + 8;
  const top = at.y + RADIUS + 5;

  context.fillStyle = pointLight
    ? 'rgba(255, 255, 255, 0.94)'
    : 'rgba(2, 6, 23, 0.85)';
  context.fillRect(at.x - width / 2, top - 1, width, 16);
  context.fillStyle = pointLight ? '#28313a' : '#e2e8f0';
  context.fillText(text, at.x, top + 1);
}

/**
 * Draws electrical points, the selection ring and the placement ghost. Inputs
 * are world coordinates; conversion to screen pixels happens only here.
 */
export function drawPointsOverlay(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  points: readonly PointRenderItem[],
  selectedId: string | null,
  ghost: PointGhost | null,
  showLabels = true,
  light = false,
): void {
  pointLight = light;
  context.save();

  for (const point of points) {
    const at = worldToScreen(point, viewport, size);

    if (
      at.x < -40 ||
      at.y < -40 ||
      at.x > size.width + 40 ||
      at.y > size.height + 40
    ) {
      continue;
    }

    if (point.id === selectedId) {
      context.beginPath();
      context.arc(at.x, at.y, RADIUS + 7, 0, Math.PI * 2);
      context.setLineDash([4, 3]);
      context.lineWidth = 1.5;
      context.strokeStyle = pointLight ? '#2f6bd8' : '#fbbf24';
      context.stroke();
      context.setLineDash([]);
    }

    drawSymbol(context, point.type, at, point.rotation, 1);

    if (showLabels && point.label) {
      drawPointLabel(context, point.label, at);
    }
  }

  if (ghost) {
    drawSymbol(
      context,
      ghost.type,
      worldToScreen(ghost.at, viewport, size),
      0,
      0.55,
    );
  }

  context.restore();
}
