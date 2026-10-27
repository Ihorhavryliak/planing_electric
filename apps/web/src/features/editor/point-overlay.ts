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
  /** Signaling loop colour override. */
  color?: string | null;
  /** Loop address / loop code badge. */
  badge?: string | null;
  /** Device subtype drives EN 54 / security glyphs. */
  subtype?: string | null;
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


function signalingGlyph(
  context: CanvasRenderingContext2D,
  subtype: string,
  color: string,
): boolean {
  const r = RADIUS;

  switch (subtype) {
    case 'smoke-detector':
      circle(context, color);
      context.beginPath();
      context.arc(0, 0, 2.5, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      return true;
    case 'heat-detector':
      context.beginPath();
      context.moveTo(0, -r - 1);
      context.lineTo(r + 1, 0);
      context.lineTo(0, r + 1);
      context.lineTo(-r - 1, 0);
      context.closePath();
      context.fillStyle = pointLight ? '#ffffff' : BACKGROUND;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 2.4, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      return true;
    case 'smoke-heat-detector':
      circle(context, color);
      context.beginPath();
      context.moveTo(0, -4.5);
      context.lineTo(4.5, 0);
      context.lineTo(0, 4.5);
      context.lineTo(-4.5, 0);
      context.closePath();
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.stroke();
      return true;
    case 'motion-sensor':
      context.beginPath();
      context.moveTo(0, -r - 1);
      context.lineTo(r + 1, r - 1);
      context.lineTo(-r - 1, r - 1);
      context.closePath();
      context.fillStyle = pointLight ? '#ffffff' : BACKGROUND;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.stroke();
      context.beginPath();
      context.arc(0, 1, 2.2, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      return true;
    case 'door-contact':
      context.strokeStyle = color;
      context.lineWidth = 1.8;
      context.strokeRect(-r, -5, r * 2, 10);
      context.fillStyle = color;
      context.fillRect(-r + 2, -3, 5, 6);
      return true;
    case 'manual-call-point':
      context.strokeStyle = color;
      context.lineWidth = 1.8;
      context.strokeRect(-r, -r, r * 2, r * 2);
      context.beginPath();
      context.arc(0, 0, 3, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      return true;
    case 'siren-internal':
    case 'siren-external':
    case 'voice-alarm':
      context.beginPath();
      context.moveTo(-r, -5);
      context.lineTo(0, -5);
      context.lineTo(r + 2, -r);
      context.lineTo(r + 2, r);
      context.lineTo(0, 5);
      context.lineTo(-r, 5);
      context.closePath();
      context.fillStyle = pointLight ? '#ffffff' : BACKGROUND;
      context.fill();
      context.lineWidth = 1.8;
      context.strokeStyle = color;
      context.stroke();
      return true;
    case 'strobe':
      context.beginPath();
      context.arc(0, 0, r, 0, Math.PI * 2);
      context.fillStyle = pointLight ? '#ffffff' : BACKGROUND;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.stroke();
      line(context, -4, 0, 4, 0);
      line(context, 0, -4, 0, 4);
      return true;
    case 'ip-camera':
      context.strokeStyle = color;
      context.lineWidth = 1.8;
      context.strokeRect(-r, -5, 11, 10);
      context.beginPath();
      context.moveTo(2, -4);
      context.lineTo(r + 2, -7);
      context.lineTo(r + 2, 7);
      context.lineTo(2, 4);
      context.closePath();
      context.stroke();
      return true;
    case 'nvr':
      context.strokeStyle = color;
      context.lineWidth = 1.8;
      context.strokeRect(-r, -6, r * 2, 12);
      context.beginPath();
      context.arc(-4, 0, 1.5, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      return true;
    default:
      return false;
  }
}

function drawSymbol(
  context: CanvasRenderingContext2D,
  type: ElectricalPointType,
  at: Vec2,
  rotation: number,
  alpha: number,
  color?: string | null,
  subtype?: string | null,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.translate(at.x, at.y);
  context.rotate((rotation * Math.PI) / 180);
  context.lineCap = 'round';
  const resolved = color ?? POINT_SYMBOLS[type].color;
  if (!(subtype && signalingGlyph(context, subtype, resolved))) {
    PAINTERS[type](context, resolved);
  }
  context.restore();
}

function drawAddressBadge(
  context: CanvasRenderingContext2D,
  text: string,
  at: Vec2,
  color: string,
): void {
  context.font = '700 9px ui-monospace, SFMono-Regular, monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';

  const paddingX = 4;
  const height = 13;
  const width = context.measureText(text).width + paddingX * 2;
  const left = at.x + RADIUS + 1;
  const top = at.y - RADIUS - height;

  context.fillStyle = pointLight ? '#ffffff' : '#020617';
  context.fillRect(left, top, width, height);
  context.lineWidth = 1;
  context.strokeStyle = color;
  context.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
  context.fillStyle = color;
  context.fillText(text, left + paddingX, top + height / 2 + 0.5);
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
      context.shadowColor = pointLight
        ? 'rgba(47, 107, 216, 0.45)'
        : 'rgba(251, 191, 36, 0.55)';
      context.shadowBlur = 10;
      context.stroke();
      context.shadowBlur = 0;
      context.setLineDash([]);
    }

    drawSymbol(
      context,
      point.type,
      at,
      point.rotation,
      1,
      point.color ?? null,
      point.subtype ?? null,
    );

    if (showLabels && point.badge) {
      drawAddressBadge(context, point.badge, at, point.color ?? '#2f6bd8');
    }

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
