import type { EditorViewport, RouteMounting } from '@drawmyplace/contracts';
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
  circuitId?: string | null;
  mounting?: RouteMounting | null;
  startPinned?: boolean;
  endPinned?: boolean;
}

export interface RouteCircuitBadge {
  id: string;
  color: string;
}

export interface RouteOverlayOptions {
  /** Circuits are drawn as a coloured chip on the route when labels are on. */
  circuits?: readonly RouteCircuitBadge[];
  showLabels?: boolean;
  /** Wall crossing markers (world coordinates). */
  penetrations?: readonly Vec2[];
  /** Point under a route end being dragged; draws a magnetic snap cue. */
  attachHint?: Vec2 | null;
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

/** Midpoint along a screen-space polyline, used for the circuit chip. */
function pathMidpoint(path: readonly Vec2[]): Vec2 | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0] ?? null;

  let total = 0;

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) total += distanceBetween(a, b);
  }

  let remaining = total / 2;

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];

    if (!a || !b) continue;

    const segment = distanceBetween(a, b);

    if (segment >= remaining) {
      const ratio = segment === 0 ? 0 : remaining / segment;
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
      };
    }

    remaining -= segment;
  }

  return path[path.length - 1] ?? null;
}

function drawCircuitChip(
  context: CanvasRenderingContext2D,
  at: Vec2,
  text: string,
  color: string,
): void {
  context.font = '600 10px ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';

  const paddingX = 6;
  const height = 16;
  const width = context.measureText(text).width + paddingX * 2 + 8;
  const left = at.x - width / 2;
  const top = at.y - height - 9;

  context.fillStyle = 'rgba(2, 6, 23, 0.9)';
  context.fillRect(left, top, width, height);
  context.lineWidth = 1;
  context.strokeStyle = color;
  context.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

  context.fillStyle = color;
  context.fillRect(left + 5, top + height / 2 - 2, 4, 4);

  context.fillStyle = '#e2e8f0';
  context.fillText(text, left + paddingX + 8, top + height / 2 + 0.5);
}

function drawPenetration(
  context: CanvasRenderingContext2D,
  at: Vec2,
): void {
  context.save();
  context.translate(at.x, at.y);
  context.rotate(Math.PI / 4);

  context.fillStyle = 'rgba(2, 6, 23, 0.95)';
  context.fillRect(-4, -4, 8, 8);
  context.lineWidth = 1.5;
  context.strokeStyle = '#f472b6';
  context.strokeRect(-4, -4, 8, 8);

  context.restore();
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
  options: RouteOverlayOptions = {},
): void {
  const circuitColors = new Map(
    (options.circuits ?? []).map((circuit) => [circuit.id, circuit.color]),
  );

  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const route of routes) {
    const path = route.geometry.map((v) => worldToScreen(v, viewport, size));
    const selected = route.id === selectedId;

    if (route.mounting === 'chase') {
      // A chase is drawn as a wide translucent band with a dashed centreline.
      tracePath(context, path);
      context.lineWidth = 12;
      context.strokeStyle = 'rgba(251, 146, 60, 0.22)';
      context.stroke();

      tracePath(context, path);
      context.setLineDash([9, 6]);
      context.lineWidth = selected ? 3 : 2;
      context.strokeStyle = selected ? SELECTED_COLOR : ROUTE_COLOR;
      context.stroke();
      context.setLineDash([]);
    } else {
      tracePath(context, path);
      context.lineWidth = selected ? 4 : 2.5;
      context.strokeStyle = selected ? SELECTED_COLOR : ROUTE_COLOR;
      context.stroke();
    }

    if (options.showLabels !== false && route.circuitId) {
      const midpoint = pathMidpoint(path);

      if (midpoint) {
        drawCircuitChip(
          context,
          midpoint,
          route.circuitId,
          circuitColors.get(route.circuitId) ?? ROUTE_COLOR,
        );
      }
    }

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

  for (const route of routes) {
    if (!route.startPinned && !route.endPinned) continue;
    if (route.geometry.length < 2) continue;
    const path = route.geometry.map((v) => worldToScreen(v, viewport, size));

    for (const [end, pinned] of [
      ['start', route.startPinned],
      ['end', route.endPinned],
    ] as const) {
      if (!pinned) continue;
      const at = end === 'start' ? path[0] : path[path.length - 1];
      if (!at) continue;

      context.beginPath();
      context.arc(at.x, at.y, 5.5, 0, Math.PI * 2);
      context.fillStyle = '#020617';
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = end === 'start' ? '#38bdf8' : '#34d399';
      context.stroke();

      context.beginPath();
      context.arc(at.x, at.y, 2, 0, Math.PI * 2);
      context.fillStyle = end === 'start' ? '#38bdf8' : '#34d399';
      context.fill();
    }
  }

  if (options.attachHint) {
    const at = worldToScreen(options.attachHint, viewport, size);

    context.beginPath();
    context.arc(at.x, at.y, 9, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    context.stroke();
    context.beginPath();
    context.arc(at.x, at.y, 4, 0, Math.PI * 2);
    context.fillStyle = 'rgba(251, 191, 36, 0.25)';
    context.fill();
  }

  for (const penetration of options.penetrations ?? []) {
    drawPenetration(context, worldToScreen(penetration, viewport, size));
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
