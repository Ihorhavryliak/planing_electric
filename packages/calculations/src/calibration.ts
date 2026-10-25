import { distance, type Point2D } from './geometry';

export const LENGTH_UNITS = ['mm', 'cm', 'm'] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

const METERS_PER_UNIT: Record<LengthUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
};

export class CalibrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalibrationError';
  }
}

export interface CalibrationInput {
  pointA: Point2D;
  pointB: Point2D;
  /** Known real-world distance between the points, in `unit`. */
  realDistance: number;
  unit?: LengthUnit;
}

export interface Calibration {
  pointA: Point2D;
  pointB: Point2D;
  realDistance: number;
  unit: LengthUnit;
  /** Distance between the points in drawing (world/pixel) units. */
  drawingDistance: number;
  /** Real meters represented by one drawing unit. */
  metersPerUnit: number;
}

export function toMeters(value: number, unit: LengthUnit): number {
  return value * METERS_PER_UNIT[unit];
}

/**
 * metersPerUnit = realDistance(m) / drawingDistance.
 * Rejects zero/negative/non-finite distances and coincident points.
 */
export function calibrate(input: CalibrationInput): Calibration {
  const unit = input.unit ?? 'm';
  const { pointA, pointB, realDistance } = input;

  if (!LENGTH_UNITS.includes(unit)) {
    throw new CalibrationError(`Unsupported unit: ${String(unit)}`);
  }
  if (!Number.isFinite(realDistance) || realDistance <= 0) {
    throw new CalibrationError('Real distance must be a positive number');
  }
  const drawingDistance = distance(pointA, pointB);
  if (!Number.isFinite(drawingDistance) || drawingDistance <= 0) {
    throw new CalibrationError('Calibration points must not coincide');
  }

  return {
    pointA,
    pointB,
    realDistance,
    unit,
    drawingDistance,
    metersPerUnit: toMeters(realDistance, unit) / drawingDistance,
  };
}
