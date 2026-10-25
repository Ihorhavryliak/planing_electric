import type { EditorViewport } from '@drawmyplace/contracts';
import {
  distanceBetween,
  findPointAt,
  worldToScreen,
  type CanvasSize,
  type HitTarget,
  type Vec2,
} from './editor-geometry';

/** Distance from point `p` to the segment `a`-`b` (any consistent unit). */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceBetween(p, a);
  }

  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared),
  );

  return distanceBetween(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export interface RouteTarget {
  id: string;
  geometry: readonly Vec2[];
}

export interface RouteEndsUpdate {
  id: string;
  geometry: Vec2[];
}

/** Same tolerance as the server calculation when matching route ends to points. */
export const CONNECT_TOLERANCE = 1e-6;

/**
 * Moves route ends that sit exactly on `from` to `to` (both route ends are
 * checked). A point drag must keep its cable routes attached, otherwise the
 * server stops adding their vertical drops.
 */
export function moveAttachedRouteEnds(
  routes: readonly RouteTarget[],
  from: Vec2,
  to: Vec2,
  tolerance = CONNECT_TOLERANCE,
): RouteEndsUpdate[] {
  if (from.x === to.x && from.y === to.y) {
    return [];
  }

  const updates: RouteEndsUpdate[] = [];

  for (const route of routes) {
    if (route.geometry.length < 2) {
      continue;
    }

    const geometry = route.geometry.map((vertex) => ({ ...vertex }));
    const first = geometry[0] as Vec2;
    const last = geometry[geometry.length - 1] as Vec2;
    let changed = false;

    if (distanceBetween(first, from) <= tolerance) {
      geometry[0] = { x: to.x, y: to.y };
      changed = true;
    }

    if (distanceBetween(last, from) <= tolerance) {
      geometry[geometry.length - 1] = { x: to.x, y: to.y };
      changed = true;
    }

    if (changed) {
      updates.push({ id: route.id, geometry });
    }
  }

  return updates;
}

/**
 * Inserts a bend before `index` (0 <= index <= geometry.length). Returns null
 * for an invalid index or a bend that would duplicate an existing vertex.
 */
export function insertVertexAt(
  geometry: readonly Vec2[],
  index: number,
  at: Vec2,
  tolerance = CONNECT_TOLERANCE,
): Vec2[] | null {
  if (!Number.isInteger(index) || index < 0 || index > geometry.length) {
    return null;
  }

  const previous = index > 0 ? geometry[index - 1] : undefined;
  const next = index < geometry.length ? geometry[index] : undefined;

  if (
    (previous && distanceBetween(previous, at) <= tolerance) ||
    (next && distanceBetween(next, at) <= tolerance)
  ) {
    return null;
  }

  return [
    ...geometry.slice(0, index).map((vertex) => ({ ...vertex })),
    { x: at.x, y: at.y },
    ...geometry.slice(index).map((vertex) => ({ ...vertex })),
  ];
}

/** Removes a bend; a route must keep at least two vertices. */
export function removeVertexAt(
  geometry: readonly Vec2[],
  index: number,
): Vec2[] | null {
  if (
    geometry.length <= 2 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= geometry.length
  ) {
    return null;
  }

  return geometry
    .filter((_, vertexIndex) => vertexIndex !== index)
    .map((vertex) => ({ ...vertex }));
}

export interface RouteSegmentHandle {
  /** Segment between geometry[segmentIndex] and geometry[segmentIndex + 1]. */
  segmentIndex: number;
  /** World coordinates of the segment midpoint. */
  at: Vec2;
}

/** Segments shorter than this on screen get no insert handle (zoom in instead). */
export const MIN_SEGMENT_HANDLE_PX = 16;

/**
 * Midpoint handle of a segment of the selected route under a screen position.
 * Short segments are skipped so their midpoint cannot be confused with a bend.
 */
export function findRouteSegmentHandleAt(
  route: RouteTarget,
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 9,
  minSegmentPx = MIN_SEGMENT_HANDLE_PX,
): RouteSegmentHandle | null {
  let best: RouteSegmentHandle | null = null;
  let bestDistance = radiusPx;

  for (let i = 1; i < route.geometry.length; i += 1) {
    const a = route.geometry[i - 1];
    const b = route.geometry[i];

    if (!a || !b) {
      continue;
    }

    const screenA = worldToScreen(a, viewport, size);
    const screenB = worldToScreen(b, viewport, size);

    if (distanceBetween(screenA, screenB) < minSegmentPx) {
      continue;
    }

    const at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const gap = distanceBetween(worldToScreen(at, viewport, size), screen);

    if (gap <= bestDistance) {
      bestDistance = gap;
      best = { segmentIndex: i - 1, at };
    }
  }

  return best;
}

/**
 * Id of the route whose polyline passes nearest to a screen position, within
 * `radiusPx`, or null. The later route (drawn on top) wins a tie.
 */
export function findRouteAt(
  routes: readonly RouteTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 8,
): string | null {
  let bestId: string | null = null;
  let bestDistance = radiusPx;

  for (const route of routes) {
    const path = route.geometry.map((vertex) =>
      worldToScreen(vertex, viewport, size),
    );

    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];

      if (!a || !b) {
        continue;
      }

      const gap = distanceToSegment(screen, a, b);

      if (gap <= bestDistance) {
        bestDistance = gap;
        bestId = route.id;
      }
    }
  }

  return bestId;
}

/**
 * Exact coordinates of the electrical point under a screen position, or null.
 * Returning the point's own numbers keeps a route end bit-for-bit equal to the
 * point, which is how the server decides to add a vertical drop.
 */
export function snapToPoint(
  points: readonly HitTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 12,
): Vec2 | null {
  const id = findPointAt(points, screen, viewport, size, radiusPx);
  const hit = id === null ? undefined : points.find((p) => p.id === id);

  return hit ? { x: hit.x, y: hit.y } : null;
}

export interface ClickRecord extends Vec2 {
  time: number;
}

/** Two clicks close in time and space; used to finish a route. */
export function isDoubleClick(
  previous: ClickRecord | null,
  current: ClickRecord,
  maxMs = 350,
  maxPx = 6,
): boolean {
  return (
    previous !== null &&
    current.time - previous.time <= maxMs &&
    distanceBetween(previous, current) <= maxPx
  );
}
