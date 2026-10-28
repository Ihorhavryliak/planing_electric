import type { Vec2 } from './editor-geometry';

export interface BundleRoute {
  id: string;
  geometry: readonly Vec2[];
  mounting?: string | null;
  /** Centreline height, so cables at different levels are not bundled. */
  elevationMm?: number | null;
}

export interface RouteBundle {
  /** How many routes share at least one run with this route. */
  size: number;
  /** Position inside the bundle; used for the lateral offset. */
  index: number;
}

interface BundleOptions {
  /** Minimum shared run length in plan units. */
  minOverlap?: number;
  /** Distance between the cable centreline and the detected wall line. */
  tolerance?: number;
}

/** Above this many routes the quadratic comparison is skipped. */
const MAX_BUNDLE_ROUTES = 400;

function perpendicularDistance(
  point: Vec2,
  origin: Vec2,
  ux: number,
  uy: number,
): number {
  return Math.abs((point.x - origin.x) * -uy + (point.y - origin.y) * ux);
}

function sharesRun(
  first: readonly Vec2[],
  second: readonly Vec2[],
  minOverlap: number,
  tolerance: number,
): boolean {
  for (let a = 0; a < first.length - 1; a += 1) {
    const a1 = first[a];
    const a2 = first[a + 1];

    if (!a1 || !a2) continue;

    const dx = a2.x - a1.x;
    const dy = a2.y - a1.y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-6) continue;

    const ux = dx / length;
    const uy = dy / length;

    for (let b = 0; b < second.length - 1; b += 1) {
      const b1 = second[b];
      const b2 = second[b + 1];

      if (!b1 || !b2) continue;
      if (perpendicularDistance(b1, a1, ux, uy) > tolerance) continue;
      if (perpendicularDistance(b2, a1, ux, uy) > tolerance) continue;

      const t1 = (b1.x - a1.x) * ux + (b1.y - a1.y) * uy;
      const t2 = (b2.x - a1.x) * ux + (b2.y - a1.y) * uy;
      const overlap =
        Math.min(length, Math.max(t1, t2)) -
        Math.max(0, Math.min(t1, t2));

      if (overlap >= minOverlap) {
        return true;
      }
    }
  }

  return false;
}

function findRoot(parent: number[], index: number): number {
  let current = index;

  while (parent[current] !== current) {
    parent[current] = parent[parent[current] ?? current] ?? current;
    current = parent[current] ?? current;
  }

  return current;
}

/**
 * Finds the routes that run along the same line (same mounting) so they can be
 * drawn side by side. Offsetting overlapping cables is what makes several
 * circuits visible on one corridor; a plain colour on top of a colour hides
 * every cable except the last one.
 */
export function computeRouteBundles(
  routes: readonly BundleRoute[],
  options: BundleOptions = {},
): Map<string, RouteBundle> {
  const minOverlap = options.minOverlap ?? 6;
  const tolerance = options.tolerance ?? 2.5;
  const result = new Map<string, RouteBundle>();
  const parent = routes.map((_, index) => index);

  if (routes.length > MAX_BUNDLE_ROUTES) {
    routes.forEach((route) => result.set(route.id, { size: 1, index: 0 }));
    return result;
  }

  for (let first = 0; first < routes.length; first += 1) {
    const a = routes[first];

    if (!a || a.geometry.length < 2) continue;

    for (let second = first + 1; second < routes.length; second += 1) {
      const b = routes[second];

      if (!b || b.geometry.length < 2) continue;
      if ((a.mounting ?? '') !== (b.mounting ?? '')) continue;
      if ((a.elevationMm ?? -1) !== (b.elevationMm ?? -1)) continue;
      if (findRoot(parent, first) === findRoot(parent, second)) continue;

      if (
        sharesRun(a.geometry, b.geometry, minOverlap, tolerance) ||
        sharesRun(b.geometry, a.geometry, minOverlap, tolerance)
      ) {
        parent[findRoot(parent, second)] = findRoot(parent, first);
      }
    }
  }

  const groups = new Map<number, number[]>();

  routes.forEach((route, index) => {
    const root = findRoot(parent, index);
    const group = groups.get(root);

    if (group) {
      group.push(index);
    } else {
      groups.set(root, [index]);
    }
  });

  for (const group of groups.values()) {
    group.forEach((routeIndex, position) => {
      const route = routes[routeIndex];

      if (!route) return;

      result.set(route.id, { size: group.length, index: position });
    });
  }

  return result;
}

/**
 * Offsets a polyline sideways by a constant distance. Vertices use the average
 * of the neighbouring segment normals, which keeps bends closed without a
 * full miter solver. Works in screen and world space alike.
 */
export function offsetPolyline(
  points: readonly Vec2[],
  distance: number,
): Vec2[] {
  if (points.length < 2 || distance === 0) {
    return points.map((point) => ({ ...point }));
  }

  const normals: Vec2[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (!start || !end) {
      normals.push({ x: 0, y: 0 });
      continue;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-6) {
      normals.push({ x: 0, y: 0 });
    } else {
      normals.push({ x: -dy / length, y: dx / length });
    }
  }

  return points.map((point, index) => {
    const previous = normals[index - 1];
    const next = normals[index];
    let normal: Vec2 | null;

    if (previous && next) {
      const sum = { x: previous.x + next.x, y: previous.y + next.y };
      const length = Math.hypot(sum.x, sum.y);

      normal =
        length < 1e-6
          ? next
          : { x: sum.x / length, y: sum.y / length };
    } else {
      normal = previous ?? next ?? null;
    }

    if (!normal) {
      return { ...point };
    }

    return {
      x: point.x + normal.x * distance,
      y: point.y + normal.y * distance,
    };
  });
}
