export interface Point2D {
  x: number;
  y: number;
}

/** Distance between two points, in the units of the points (world units). */
export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Sum of Euclidean segment lengths of a polyline, in the units of the points.
 * Fewer than two points have no length. Non-finite coordinates throw, so a
 * corrupt route can never silently produce NaN quantities.
 */
export function polylineLength(points: readonly Point2D[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i] as Point2D;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new RangeError(`Point ${i} has non-finite coordinates`);
    }
    if (i > 0) total += distance(points[i - 1] as Point2D, p);
  }
  return total;
}

/** Round to a fixed number of decimals to remove binary floating-point noise. */
export function roundTo(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
