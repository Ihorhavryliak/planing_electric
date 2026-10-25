import type { EditorViewport } from '@drawmyplace/contracts';
import {
  distanceBetween,
  worldToScreen,
  type CanvasSize,
  type Vec2,
} from './editor-geometry';
import { MIN_SEGMENT_HANDLE_PX } from './route-geometry';

export interface RouteRenderItem {
  id: string;
  geometry: readonly Vec2[];
}

const ROUTE_COLOR = '#fb923c';
const SELECTED_COLOR = '#fbbf24';

function tracePath(
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
}

/**
 * Draws saved cable routes, the handles of the selected one and the route
 * being drawn (with a rubber band to the cursor). Inputs are world coordinates.
 * The selected route also shows a hollow circle at every segment midpoint; a
 * click there inserts a bend. Square handles are the existing bends.
 */
export function drawRoutesOverlay(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  viewport: EditorViewport,
  routes: readonly RouteRenderItem[],
  selectedId: string | null,
  draft: readonly Vec2[],
  cursor: Vec2 | null,
  selectedVertexIndex: number | null = null,
): void {
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const route of routes) {
    const path = route.geometry.map((v) => worldToScreen(v, viewport, size));
    const selected = route.id === selectedId;

    tracePath(context, path);
    context.lineWidth = selected ? 4 : 2.5;
    context.strokeStyle = selected ? SELECTED_COLOR : ROUTE_COLOR;
    context.stroke();

    if (selected) {
      path.forEach((vertex, index) => {
        const active = index === selectedVertexIndex;

        context.beginPath();
        context.rect(
          vertex.x - (active ? 5.5 : 4.5),
          vertex.y - (active ? 5.5 : 4.5),
          active ? 11 : 9,
          active ? 11 : 9,
        );
        context.fillStyle = active ? SELECTED_COLOR : '#020617';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = SELECTED_COLOR;
        context.stroke();
      });

      for (let i = 1; i < path.length; i += 1) {
        const a = path[i - 1];
        const b = path[i];

        if (!a || !b || distanceBetween(a, b) < MIN_SEGMENT_HANDLE_PX) {
          continue;
        }

        const at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        context.beginPath();
        context.arc(at.x, at.y, 4, 0, Math.PI * 2);
        context.fillStyle = 'rgba(2, 6, 23, 0.85)';
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = 'rgba(251, 191, 36, 0.75)';
        context.stroke();
      }
    }
  }

  if (draft.length > 0) {
    const path = draft.map((v) => worldToScreen(v, viewport, size));

    tracePath(context, path);
    context.lineWidth = 2.5;
    context.strokeStyle = ROUTE_COLOR;
    context.stroke();

    const last = path[path.length - 1];

    if (last && cursor) {
      const end = worldToScreen(cursor, viewport, size);

      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(last.x, last.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.setLineDash([]);
    }

    for (const vertex of path) {
      context.beginPath();
      context.arc(vertex.x, vertex.y, 4, 0, Math.PI * 2);
      context.fillStyle = ROUTE_COLOR;
      context.fill();
    }
  } else if (cursor) {
    // Start-of-route marker: shows where the first click will land / snap.
    const at = worldToScreen(cursor, viewport, size);

    context.beginPath();
    context.arc(at.x, at.y, 5, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = ROUTE_COLOR;
    context.stroke();
  }

  context.restore();
}
