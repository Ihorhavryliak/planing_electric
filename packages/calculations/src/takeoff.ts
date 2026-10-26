import { polylineLength, roundTo, type Point2D } from './geometry';

export const DEFAULT_WALL_HEIGHT_METERS = 2.7;
export const DEFAULT_WALL_THICKNESS_METERS = 0.15;

export interface TakeoffWall {
  geometry: readonly Point2D[];
  /** Wall thickness in drawing units; null/omitted falls back to the default. */
  thickness?: number | null;
}

export interface TakeoffOpening {
  width: number;
  height: number;
}

export interface TakeoffRoom {
  boundary: readonly Point2D[];
}

export interface TakeoffPoint {
  type: string;
  subtype?: string | null;
}

export interface TakeoffRoute {
  circuitId: string | null;
  materialId?: string | null;
  /** Precomputed required cable length in meters (null when uncalibrated). */
  requiredLength: number | null;
}

export interface TakeoffMaterial {
  id: string;
  unitPrice: number | null;
  unit?: string;
}

export interface TakeoffInput {
  metersPerUnit: number | null;
  walls: readonly TakeoffWall[];
  openings: readonly TakeoffOpening[];
  rooms: readonly TakeoffRoom[];
  points: readonly TakeoffPoint[];
  routes: readonly TakeoffRoute[];
  materials?: readonly TakeoffMaterial[];
  defaultCableMaterialId?: string | null;
  wallHeightMeters?: number;
  defaultWallThicknessMeters?: number;
}

export interface TakeoffCircuitCable {
  circuitId: string | null;
  meters: number;
}

export interface TakeoffSummary {
  calibrated: boolean;
  /** Total centreline length of drawn walls, meters. */
  wallLengthMeters: number | null;
  /** Unique wall vertices (junction nodes included once). */
  wallNodes: number;
  wallCount: number;
  /** Wall area before subtracting openings, m². */
  grossWallAreaM2: number | null;
  openingAreaM2: number | null;
  /** Gross area minus openings, never below zero, m². */
  netWallAreaM2: number | null;
  wallVolumeM3: number | null;
  roomAreaM2: number | null;
  roomPerimeterMeters: number | null;
  deviceCounts: Record<string, number>;
  subtypeCounts: Record<string, number>;
  totalDevices: number;
  cableByCircuit: TakeoffCircuitCable[];
  totalCableMeters: number | null;
  /** Cable cost for routes that have a known unit price. */
  cableCost: number | null;
  /** How many routes contributed to `cableCost`. */
  pricedRoutes: number;
}

function polygonArea(points: readonly Point2D[]): number {
  if (points.length < 3) return 0;

  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Point2D;
    const b = points[(i + 1) % points.length] as Point2D;
    sum += a.x * b.y - b.x * a.y;
  }

  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: readonly Point2D[]): number {
  if (points.length < 2) return 0;

  let total = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Point2D;
    const b = points[(i + 1) % points.length] as Point2D;

    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }

  return total;
}

function uniqueWallNodes(walls: readonly TakeoffWall[]): number {
  const nodes = new Set<string>();

  for (const wall of walls) {
    for (const vertex of wall.geometry) {
      nodes.add(`${Math.round(vertex.x * 1e6)}:${Math.round(vertex.y * 1e6)}`);
    }
  }

  return nodes.size;
}

function weightedThicknessMeters(
  walls: readonly TakeoffWall[],
  metersPerUnit: number,
  defaultThickness: number,
): number {
  let weighted = 0;
  let length = 0;

  for (const wall of walls) {
    const wallLength = polylineLength(wall.geometry);

    if (wallLength <= 0) continue;

    const thickness = wall.thickness
      ? wall.thickness * metersPerUnit
      : defaultThickness;

    weighted += wallLength * thickness;
    length += wallLength;
  }

  return length === 0 ? defaultThickness : weighted / length;
}

/**
 * Quantities a designer needs while drawing, without generating an estimate:
 * wall geometry, room areas, device counts and cable cost. Real units require
 * a calibrated plan; counts are always available.
 */
export function buildTakeoff(input: TakeoffInput): TakeoffSummary {
  const metersPerUnit = input.metersPerUnit;
  const calibrated =
    metersPerUnit !== null && Number.isFinite(metersPerUnit) && metersPerUnit > 0;
  const height = input.wallHeightMeters ?? DEFAULT_WALL_HEIGHT_METERS;
  const defaultThickness =
    input.defaultWallThicknessMeters ?? DEFAULT_WALL_THICKNESS_METERS;

  if (calibrated && (!Number.isFinite(height) || height <= 0)) {
    throw new RangeError('wallHeightMeters must be a positive finite number');
  }

  const deviceCounts: Record<string, number> = {};
  const subtypeCounts: Record<string, number> = {};

  for (const point of input.points) {
    deviceCounts[point.type] = (deviceCounts[point.type] ?? 0) + 1;

    if (point.subtype) {
      subtypeCounts[point.subtype] = (subtypeCounts[point.subtype] ?? 0) + 1;
    }
  }

  const cableByCircuitMap = new Map<string | null, number>();
  let pricedRoutes = 0;
  let cableCost = 0;

  if (calibrated) {
    const priceById = new Map(
      (input.materials ?? []).map((material) => [material.id, material.unitPrice]),
    );
    const defaultPrice = input.defaultCableMaterialId
      ? (priceById.get(input.defaultCableMaterialId) ?? null)
      : null;

    for (const route of input.routes) {
      const meters = route.requiredLength ?? 0;
      cableByCircuitMap.set(
        route.circuitId,
        (cableByCircuitMap.get(route.circuitId) ?? 0) + meters,
      );

      if (meters <= 0) continue;

      const unitPrice = route.materialId
        ? (priceById.get(route.materialId) ?? defaultPrice)
        : defaultPrice;

      if (unitPrice !== null && Number.isFinite(unitPrice)) {
        cableCost += meters * unitPrice;
        pricedRoutes += 1;
      }
    }
  }

  const cableByCircuit = [...cableByCircuitMap.entries()]
    .map(([circuitId, meters]) => ({ circuitId, meters: roundTo(meters) }))
    .sort((a, b) => (a.circuitId ?? '').localeCompare(b.circuitId ?? ''));

  if (!calibrated) {
    return {
      calibrated: false,
      wallLengthMeters: null,
      wallNodes: uniqueWallNodes(input.walls),
      wallCount: input.walls.length,
      grossWallAreaM2: null,
      openingAreaM2: null,
      netWallAreaM2: null,
      wallVolumeM3: null,
      roomAreaM2: null,
      roomPerimeterMeters: null,
      deviceCounts,
      subtypeCounts,
      totalDevices: input.points.length,
      cableByCircuit: [],
      totalCableMeters: null,
      cableCost: null,
      pricedRoutes: 0,
    };
  }

  let wallLengthUnits = 0;

  for (const wall of input.walls) {
    wallLengthUnits += polylineLength(wall.geometry);
  }

  const wallLengthMeters = wallLengthUnits * metersPerUnit;
  const grossWallAreaM2 = wallLengthMeters * height;
  const openingAreaM2 = input.openings.reduce(
    (total, opening) =>
      total + opening.width * metersPerUnit * opening.height * metersPerUnit,
    0,
  );
  const netWallAreaM2 = Math.max(0, grossWallAreaM2 - openingAreaM2);
  const thickness = weightedThicknessMeters(
    input.walls,
    metersPerUnit,
    defaultThickness,
  );

  const roomAreaM2 = input.rooms.reduce(
    (total, room) =>
      total + polygonArea(room.boundary) * metersPerUnit * metersPerUnit,
    0,
  );
  const roomPerimeterMeters = input.rooms.reduce(
    (total, room) => total + polygonPerimeter(room.boundary) * metersPerUnit,
    0,
  );
  const totalCableMeters = cableByCircuit.reduce(
    (total, entry) => total + entry.meters,
    0,
  );

  return {
    calibrated: true,
    wallLengthMeters: roundTo(wallLengthMeters),
    wallNodes: uniqueWallNodes(input.walls),
    wallCount: input.walls.length,
    grossWallAreaM2: roundTo(grossWallAreaM2),
    openingAreaM2: roundTo(openingAreaM2),
    netWallAreaM2: roundTo(netWallAreaM2),
    wallVolumeM3: roundTo(netWallAreaM2 * thickness),
    roomAreaM2: roundTo(roomAreaM2),
    roomPerimeterMeters: roundTo(roomPerimeterMeters),
    deviceCounts,
    subtypeCounts,
    totalDevices: input.points.length,
    cableByCircuit,
    totalCableMeters: roundTo(totalCableMeters),
    cableCost: pricedRoutes > 0 ? roundTo(cableCost, 2) : null,
    pricedRoutes,
  };
}
