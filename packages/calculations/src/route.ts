import { polylineLength, roundTo, type Point2D } from './geometry';

export const DEFAULT_WASTE_PERCENT = 10;

/** Editable defaults (meters). They are project settings, not universal truths. */
export const DEFAULT_VERTICAL_DROPS_METERS = {
  socket: 1.5,
  switch: 1.5,
  light: 2.5,
  panel: 0,
  junction: 0,
  custom: 0,
} as const;

export type PointKind = keyof typeof DEFAULT_VERTICAL_DROPS_METERS;

export interface VerticalDrop {
  /** Vertical cable length in meters. */
  meters: number;
  label?: string;
  /**
   * True when the vertical run is already part of the drawn route geometry
   * (e.g. a 3D-aware route). Such drops are listed but never added again.
   */
  alreadyInGeometry?: boolean;
}

export interface RouteInput {
  points: readonly Point2D[];
  /**
   * Real meters per drawing unit. `null` when the plan is not calibrated;
   * `0` is invalid. Use 1 when points are already stored in meters.
   */
  metersPerUnit: number | null;
  drops?: readonly VerticalDrop[];
  wastePercent?: number;
}

export interface RouteBreakdown {
  /** Horizontal length in meters. */
  planLength: number;
  /** Counted vertical additions in meters (excludes alreadyInGeometry). */
  verticalLength: number;
  /** Drops skipped to avoid double counting. */
  skippedVerticalLength: number;
  /** planLength + verticalLength. */
  baseLength: number;
  wastePercent: number;
  wasteLength: number;
  /** (plan + vertical) * (1 + waste / 100). */
  requiredLength: number;
}

export type RouteResult =
  | { status: 'ok'; breakdown: RouteBreakdown; warnings: string[] }
  | { status: 'uncalibrated'; warnings: string[] };

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

export function calculateRoute(input: RouteInput): RouteResult {
  const wastePercent = input.wastePercent ?? DEFAULT_WASTE_PERCENT;
  assertNonNegativeFinite(wastePercent, 'wastePercent');

  const warnings: string[] = [];
  if (input.metersPerUnit === null) {
    return {
      status: 'uncalibrated',
      warnings: ['Plan scale is not calibrated; real lengths are unavailable.'],
    };
  }
  if (!Number.isFinite(input.metersPerUnit) || input.metersPerUnit <= 0) {
    throw new RangeError('metersPerUnit must be a positive finite number');
  }
  if (input.points.length < 2) {
    warnings.push('Route has fewer than two points.');
  }

  let vertical = 0;
  let skipped = 0;
  for (const drop of input.drops ?? []) {
    assertNonNegativeFinite(drop.meters, 'drop.meters');
    if (drop.alreadyInGeometry) skipped += drop.meters;
    else vertical += drop.meters;
  }

  const planLength = polylineLength(input.points) * input.metersPerUnit;
  const baseLength = planLength + vertical;
  const requiredLength = baseLength * (1 + wastePercent / 100);

  return {
    status: 'ok',
    warnings,
    breakdown: {
      planLength: roundTo(planLength),
      verticalLength: roundTo(vertical),
      skippedVerticalLength: roundTo(skipped),
      baseLength: roundTo(baseLength),
      wastePercent,
      wasteLength: roundTo(requiredLength - baseLength),
      requiredLength: roundTo(requiredLength),
    },
  };
}
