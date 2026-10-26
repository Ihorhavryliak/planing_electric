import type { Point2D } from './geometry';

export interface WallShape {
  id: string;
  geometry: readonly Point2D[];
}

export interface RouteShape {
  id: string;
  geometry: readonly Point2D[];
}

export interface Penetration {
  routeId: string;
  wallId: string;
  /** Crossing point in drawing units. */
  point: Point2D;
  /** Index of the route segment that crosses the wall. */
  segmentIndex: number;
}

const EPSILON = 1e-9;

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Intersection of two line segments. Parallel and collinear segments return
 * null: a cable running along a wall is not a penetration.
 */
export function segmentIntersection(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): Point2D | null {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denominator = cross(rx, ry, sx, sy);

  if (Math.abs(denominator) < EPSILON) return null;

  const qpx = b1.x - a1.x;
  const qpy = b1.y - a1.y;
  const t = cross(qpx, qpy, sx, sy) / denominator;
  const u = cross(qpx, qpy, rx, ry) / denominator;

  if (t < -EPSILON || t > 1 + EPSILON) return null;
  if (u < -EPSILON || u > 1 + EPSILON) return null;

  return { x: a1.x + t * rx, y: a1.y + t * ry };
}

function samePoint(a: Point2D, b: Point2D, epsilon: number): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

/**
 * Finds every point where a cable route crosses a wall. Adjacent route
 * segments that meet exactly on a wall produce a single penetration.
 */
export function findRoutePenetrations(
  route: RouteShape,
  walls: readonly WallShape[],
  epsilon = 1e-6,
): Omit<Penetration, 'routeId'>[] {
  const found: Omit<Penetration, 'routeId'>[] = [];

  for (let segmentIndex = 1; segmentIndex < route.geometry.length; segmentIndex += 1) {
    const a1 = route.geometry[segmentIndex - 1];
    const a2 = route.geometry[segmentIndex];

    if (!a1 || !a2) continue;

    for (const wall of walls) {
      for (let wallIndex = 1; wallIndex < wall.geometry.length; wallIndex += 1) {
        const b1 = wall.geometry[wallIndex - 1];
        const b2 = wall.geometry[wallIndex];

        if (!b1 || !b2) continue;

        const point = segmentIntersection(a1, a2, b1, b2);

        if (!point) continue;

        const duplicate = found.some(
          (entry) =>
            entry.wallId === wall.id && samePoint(entry.point, point, epsilon),
        );

        if (!duplicate) {
          found.push({ wallId: wall.id, point, segmentIndex });
        }
      }
    }
  }

  return found;
}

/** Penetrations for every route, with the route id attached. */
export function findPenetrations(
  routes: readonly RouteShape[],
  walls: readonly WallShape[],
): Penetration[] {
  return routes.flatMap((route) =>
    findRoutePenetrations(route, walls).map((entry) => ({
      routeId: route.id,
      ...entry,
    })),
  );
}

/** Number of wall penetrations per route id (routes without crossings omitted). */
export function countRoutePenetrations(
  routes: readonly RouteShape[],
  walls: readonly WallShape[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const penetration of findPenetrations(routes, walls)) {
    counts.set(penetration.routeId, (counts.get(penetration.routeId) ?? 0) + 1);
  }

  return counts;
}
