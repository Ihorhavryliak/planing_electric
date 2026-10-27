import type { EditorViewport } from '@drawmyplace/contracts';
import { worldToScreen, type CanvasSize } from './editor-geometry';

export interface SignalingCoverageItem {
  id: string;
  x: number;
  y: number;
  /** Coverage radius in metres. */
  radiusM: number;
  color: string;
  kind: 'fire' | 'siren' | 'camera' | 'security';
}

/**
 * Draws semi-transparent detector / siren / camera coverage circles.
 * Circles are clipped to the viewport and drawn below routes and points.
 */
export function drawSignalingCoverage(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  items: readonly SignalingCoverageItem[],
  metersPerUnit: number | null,
  light = false,
): void {
  if (!metersPerUnit || metersPerUnit <= 0) return;

  context.save();
  context.lineJoin = 'round';

  for (const item of items) {
    if (!Number.isFinite(item.radiusM) || item.radiusM <= 0) continue;
    const at = worldToScreen({ x: item.x, y: item.y }, viewport, size);
    const radius = (item.radiusM / metersPerUnit) * viewport.zoom;

    if (radius < 1) continue;
    if (
      at.x + radius < 0 ||
      at.y + radius < 0 ||
      at.x - radius > size.width ||
      at.y - radius > size.height
    ) {
      continue;
    }

    context.beginPath();
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fillStyle = light
      ? `${item.color}12`
      : `${item.color}1f`;
    context.fill();
    context.setLineDash([5, 5]);
    context.lineWidth = 1;
    context.strokeStyle = light ? `${item.color}66` : `${item.color}99`;
    context.stroke();
    context.setLineDash([]);

    if (item.kind === 'camera') {
      // A short cone marker makes camera coverage readable at a glance.
      context.beginPath();
      context.moveTo(at.x, at.y);
      context.arc(at.x, at.y, radius, -Math.PI / 4, Math.PI / 4);
      context.closePath();
      context.fillStyle = light ? `${item.color}0d` : `${item.color}12`;
      context.fill();
    }
  }

  context.restore();
}
