import type { EditorViewport, PublicCalibration } from '@drawmyplace/contracts';
import {
  worldToScreen,
  type CanvasSize,
  type Vec2,
} from './editor-geometry';

const ACCENT = '#fbbf24';

function drawHandle(context: CanvasRenderingContext2D, at: Vec2): void {
  context.beginPath();
  context.arc(at.x, at.y, 5, 0, Math.PI * 2);
  context.fillStyle = '#020617';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = ACCENT;
  context.stroke();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  at: Vec2,
): void {
  context.font = '600 12px ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const width = context.measureText(text).width + 14;

  context.fillStyle = 'rgba(2, 6, 23, 0.92)';
  context.fillRect(at.x - width / 2, at.y - 11, width, 22);
  context.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  context.lineWidth = 1;
  context.strokeRect(at.x - width / 2 + 0.5, at.y - 10.5, width - 1, 21);
  context.fillStyle = ACCENT;
  context.fillText(text, at.x, at.y);
}

/**
 * Draws the saved calibration segment and the two-click draft. All inputs are
 * world coordinates; they are converted to screen pixels only here.
 */
export function drawCalibrationOverlay(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  saved: PublicCalibration | null,
  draft: readonly Vec2[],
  cursor: Vec2 | null,
): void {
  context.save();

  if (saved) {
    const a = worldToScreen(saved.pointA, viewport, size);
    const b = worldToScreen(saved.pointB, viewport, size);

    context.lineWidth = 2;
    context.strokeStyle = ACCENT;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
    drawHandle(context, a);
    drawHandle(context, b);
    drawLabel(
      context,
      `${saved.realDistance} ${saved.unit}`,
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16 },
    );
  }

  const first = draft[0];

  if (first) {
    const a = worldToScreen(first, viewport, size);

    if (cursor) {
      const b = worldToScreen(cursor, viewport, size);

      context.setLineDash([6, 5]);
      context.lineWidth = 2;
      context.strokeStyle = ACCENT;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.setLineDash([]);
    }

    drawHandle(context, a);
  }

  context.restore();
}
