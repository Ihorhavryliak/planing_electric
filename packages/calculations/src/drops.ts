import { distance, type Point2D } from './geometry';
import {
  DEFAULT_VERTICAL_DROPS_METERS,
  type PointKind,
  type VerticalDrop,
} from './route';

export interface DropPoint extends Point2D {
  id: string;
  type: PointKind;
  label?: string | null;
  /** Per-point override in meters; wins over the defaults. */
  verticalDropMeters?: number | null;
}

export interface ResolvedDrop extends VerticalDrop {
  pointId: string;
  label: string;
}

export interface ResolveDropsInput {
  geometry: readonly Point2D[];
  points: readonly DropPoint[];
  /** Max distance (drawing units) for a route end to count as connected. */
  tolerance?: number;
  defaults?: Readonly<Record<PointKind, number>>;
}

export const DEFAULT_CONNECT_TOLERANCE = 1e-6;

function nearestPoint(
  target: Point2D,
  points: readonly DropPoint[],
  tolerance: number,
): DropPoint | null {
  let best: DropPoint | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const d = distance(target, point);
    if (d <= tolerance && d < bestDistance) {
      best = point;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * A vertical drop is added for each route END (first and last vertex) that
 * coincides with an electrical point. Intermediate bends never get a drop,
 * so a point lying on the route does not add cable twice.
 */
export function resolveRouteDrops(input: ResolveDropsInput): ResolvedDrop[] {
  const { geometry, points } = input;
  const tolerance = input.tolerance ?? DEFAULT_CONNECT_TOLERANCE;
  const defaults = input.defaults ?? DEFAULT_VERTICAL_DROPS_METERS;
  if (geometry.length < 2) return [];

  const ends = [geometry[0] as Point2D, geometry[geometry.length - 1] as Point2D];
  const drops: ResolvedDrop[] = [];
  for (const end of ends) {
    const point = nearestPoint(end, points, tolerance);
    if (!point) continue;
    drops.push({
      pointId: point.id,
      label: point.label?.trim() || point.type,
      meters: point.verticalDropMeters ?? defaults[point.type],
    });
  }
  return drops;
}
