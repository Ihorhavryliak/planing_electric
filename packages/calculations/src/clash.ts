import { segmentIntersection } from './penetration';
import type { Point2D } from './geometry';

export interface ClashRoute {
  id: string;
  circuitId: string | null;
  geometry: readonly Point2D[];
  /** Installation level; routes on different levels do not clash. */
  mounting?: string | null;
}

export interface ClashPoint {
  id: string;
  type: string;
  x: number;
  y: number;
  circuitId?: string | null;
}

export type ClashKind = 'route-route' | 'route-point';
export type ClashSeverity = 'error' | 'warning';

export interface Clash {
  id: string;
  kind: ClashKind;
  severity: ClashSeverity;
  /** Where the clash occurs, in drawing units. */
  point: Point2D;
  routeId: string;
  /** Second route for route-route clashes, point id for route-point clashes. */
  otherId: string;
  /** Index of the route segment that contains the clash point. */
  segmentIndex: number;
}

export interface ClashOptions {
  /**
   * Minimum clearance in drawing units. Zero only reports physical crossings;
   * pass `0.05 / metersPerUnit` to also catch parallel runs closer than 5 cm.
   */
  minSeparation?: number;
}

const EPSILON = 1e-6;

function samePoint(a: Point2D, b: Point2D, epsilon = EPSILON): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function pointSegmentDistance(
  point: Point2D,
  a: Point2D,
  b: Point2D,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= EPSILON) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
    ),
  );

  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Closest distance between two segments (0 when they intersect). */
export function segmentDistance(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): number {
  if (segmentIntersection(a1, a2, b1, b2)) return 0;

  return Math.min(
    pointSegmentDistance(a1, b1, b2),
    pointSegmentDistance(a2, b1, b2),
    pointSegmentDistance(b1, a1, a2),
    pointSegmentDistance(b2, a1, a2),
  );
}

function mountingCompatible(a: ClashRoute, b: ClashRoute): boolean {
  if (!a.mounting || !b.mounting) return true;
  return a.mounting === b.mounting;
}

function routeEndpoints(route: ClashRoute): Point2D[] {
  const first = route.geometry[0];
  const last = route.geometry[route.geometry.length - 1];

  return [first, last].filter((point): point is Point2D => Boolean(point));
}

function atRouteEndpoint(route: ClashRoute, point: Point2D): boolean {
  return routeEndpoints(route).some((endpoint) =>
    samePoint(endpoint, point),
  );
}

function pairId(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Finds cable routes that physically cross each other on the same mounting
 * level. Crossings exactly at a route endpoint are ignored: routes that start
 * at the same board or device are expected to meet there.
 */
export function findRouteRouteClashes(
  routes: readonly ClashRoute[],
): Clash[] {
  const clashes: Clash[] = [];

  for (let first = 0; first < routes.length; first += 1) {
    const a = routes[first];
    if (!a) continue;

    for (let second = first + 1; second < routes.length; second += 1) {
      const b = routes[second];
      if (!b || !mountingCompatible(a, b)) continue;

      const [idA, idB] = pairId(a.id, b.id);

      for (let ai = 1; ai < a.geometry.length; ai += 1) {
        const a1 = a.geometry[ai - 1];
        const a2 = a.geometry[ai];
        if (!a1 || !a2) continue;

        for (let bi = 1; bi < b.geometry.length; bi += 1) {
          const b1 = b.geometry[bi - 1];
          const b2 = b.geometry[bi];
          if (!b1 || !b2) continue;

          const point = segmentIntersection(a1, a2, b1, b2);
          if (!point) continue;
          if (atRouteEndpoint(a, point) || atRouteEndpoint(b, point)) continue;

          clashes.push({
            id: `route-route:${idA}:${idB}:${point.x.toFixed(4)}:${point.y.toFixed(4)}`,
            kind: 'route-route',
            severity:
              a.circuitId && b.circuitId && a.circuitId === b.circuitId
                ? 'warning'
                : 'error',
            point,
            routeId: a.id,
            otherId: b.id,
            segmentIndex: ai - 1,
          });
        }
      }
    }
  }

  return clashes;
}

/**
 * Finds routes that run through an unrelated device. Routes reaching their own
 * sockets/switches are skipped because those points are legitimate endpoints;
 * junction boxes only warn, other devices are errors.
 */
export function findRoutePointClashes(
  routes: readonly ClashRoute[],
  points: readonly ClashPoint[],
): Clash[] {
  const clashes: Clash[] = [];

  for (const route of routes) {
    for (const point of points) {
      if (point.circuitId && point.circuitId === route.circuitId) continue;

      for (let index = 1; index < route.geometry.length; index += 1) {
        const a = route.geometry[index - 1];
        const b = route.geometry[index];
        if (!a || !b) continue;

        if (pointSegmentDistance(point, a, b) > EPSILON) continue;

        const at = { x: point.x, y: point.y };
        if (atRouteEndpoint(route, at)) continue;

        clashes.push({
          id: `route-point:${route.id}:${point.id}`,
          kind: 'route-point',
          severity: point.type === 'junction' ? 'warning' : 'error',
          point: at,
          routeId: route.id,
          otherId: point.id,
          segmentIndex: index - 1,
        });
        break;
      }
    }
  }

  return clashes;
}

/**
 * Cross-network clash report used by validation and the 3D view. Parallel
 * proximity is opt-in through `minSeparation`; by default only true crossings
 * are reported so a shared trunk does not flood the list.
 */
export function findClashes(
  input: {
    routes: readonly ClashRoute[];
    points?: readonly ClashPoint[];
  },
  options: ClashOptions = {},
): Clash[] {
  const minSeparation = Math.max(0, options.minSeparation ?? 0);
  const clashes = [
    ...findRouteRouteClashes(input.routes),
    ...findRoutePointClashes(input.routes, input.points ?? []),
  ];

  if (minSeparation > 0) {
    const seen = new Set(clashes.map((clash) => clash.id));

    for (let first = 0; first < input.routes.length; first += 1) {
      const a = input.routes[first];
      if (!a) continue;

      for (let second = first + 1; second < input.routes.length; second += 1) {
        const b = input.routes[second];
        if (!b || !mountingCompatible(a, b)) continue;

        const [idA, idB] = pairId(a.id, b.id);

        for (let ai = 1; ai < a.geometry.length; ai += 1) {
          const a1 = a.geometry[ai - 1];
          const a2 = a.geometry[ai];
          if (!a1 || !a2) continue;

          for (let bi = 1; bi < b.geometry.length; bi += 1) {
            const b1 = b.geometry[bi - 1];
            const b2 = b.geometry[bi];
            if (!b1 || !b2) continue;

            if (segmentDistance(a1, a2, b1, b2) >= minSeparation) continue;

            if (segmentIntersection(a1, a2, b1, b2)) continue;

            const point = {
              x: (a2.x + b1.x) / 2,
              y: (a2.y + b1.y) / 2,
            };
            const id = `route-route:${idA}:${idB}:${point.x.toFixed(4)}:${point.y.toFixed(4)}`;

            if (seen.has(id)) continue;
            seen.add(id);

            clashes.push({
              id,
              kind: 'route-route',
              severity:
                a.circuitId && b.circuitId && a.circuitId === b.circuitId
                  ? 'warning'
                  : 'error',
              point,
              routeId: a.id,
              otherId: b.id,
              segmentIndex: ai - 1,
            });
          }
        }
      }
    }
  }

  return clashes;
}
