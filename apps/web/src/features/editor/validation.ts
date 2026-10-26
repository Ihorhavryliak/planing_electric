import {
  findClashes,
  findRoutePenetrations,
  polylineLength,
  type ElectricalIssueCode,
  type ElectricalPlanResult,
  type Point2D,
} from '@drawmyplace/calculations';
import {
  NORM_REFERENCES,
  isWetRoomName,
  pointInPolygon,
} from './normative';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCode =
  | 'uncalibrated'
  | 'duplicateCircuit'
  | 'pointWithoutCircuit'
  | 'pointUnknownCircuit'
  | 'routeWithoutCircuit'
  | 'routeUnknownCircuit'
  | 'routeUnknownMaterial'
  | 'routeZeroLength'
  | 'routeUnconnectedEnds'
  | 'routeCrossesWall'
  | 'routeClash'
  | 'routePointClash'
  | 'isolatedPoint'
  | 'openingOutsideWall'
  | 'openingMissingWall'
  | 'unusedCircuit'
  | 'pinnedPointMissing'
  | 'pinnedEndMismatch'
  | 'panelOverflow'
  | 'panelNearlyFull'
  | 'mainBreakerUndersized'
  | 'normWetZoneRcd'
  | 'normJunctionWetZone'
  | ElectricalIssueCode;

export type ValidationTarget =
  | {
      kind: 'point' | 'route' | 'wall' | 'opening' | 'room' | 'circuit';
      id: string;
    }
  | { kind: 'calibration' }
  | { kind: 'panel' };

export interface ValidationIssue {
  id: string;
  code: ValidationCode;
  severity: ValidationSeverity;
  /** Number of affected objects. */
  count: number;
  targets: ValidationTarget[];
  params?: Record<string, string | number>;
  /** Normative clause for normocontrol rows. */
  norm?: string;
}

export interface ValidationWall {
  id: string;
  geometry: readonly Point2D[];
}

export interface ValidationOpening {
  id: string;
  wallId: string;
  offset: number;
  width: number;
}

export interface ValidationPoint {
  id: string;
  type: string;
  label?: string | null;
  x: number;
  y: number;
  properties: { circuitId?: string | null };
}

export interface ValidationRoute {
  id: string;
  circuitId: string | null;
  materialId?: string | null;
  startPointId?: string | null;
  endPointId?: string | null;
  geometry: readonly Point2D[];
  settings: { mounting?: string };
}

export interface ValidationInput {
  calibration: { metersPerUnit: number } | null;
  circuits: readonly { id: string; name?: string }[];
  points: readonly ValidationPoint[];
  routes: readonly ValidationRoute[];
  walls: readonly ValidationWall[];
  openings: readonly ValidationOpening[];
  rooms?: readonly { id: string; name: string; boundary: readonly Point2D[] }[];
  /** Known material ids; when omitted, material references are not checked. */
  materialIds?: readonly string[];
  /** Load, voltage-drop and protection results for the electrical rules. */
  electrical?: ElectricalPlanResult | null;
  panelSchedule?: import('@drawmyplace/calculations').PanelSchedule | null;
}

const ENDPOINT_TOLERANCE = 1e-6;

function near(a: Point2D, b: Point2D, tolerance: number): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

function issue(
  code: ValidationCode,
  severity: ValidationSeverity,
  targets: ValidationTarget[],
  params?: Record<string, string | number>,
  norm?: string,
): ValidationIssue {
  return {
    id: `${code}:${targets
      .map((target) => ('id' in target ? target.id : target.kind))
      .join(',')}`,
    code,
    severity,
    count: Math.max(1, targets.length),
    targets,
    params,
    norm,
  };
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

/**
 * Collects plan-wide issues for the validation panel. Every rule returns one
 * aggregated row with the affected objects, so a plan with 40 unconnected
 * sockets stays readable while still allowing jump-to-object.
 */
export function validatePlan(input: ValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const circuitIds = new Set(input.circuits.map((circuit) => circuit.id));
  const materialIds = input.materialIds ? new Set(input.materialIds) : null;
  const tolerance =
    input.calibration && input.calibration.metersPerUnit > 0
      ? 0.05 / input.calibration.metersPerUnit
      : ENDPOINT_TOLERANCE;

  if (!input.calibration) {
    issues.push(issue('uncalibrated', 'warning', [{ kind: 'calibration' }]));
  }

  const codeCounts = new Map<string, number>();

  for (const circuit of input.circuits) {
    codeCounts.set(circuit.id, (codeCounts.get(circuit.id) ?? 0) + 1);
  }

  for (const [code, count] of codeCounts) {
    if (count > 1) {
      issues.push(
        issue(
          'duplicateCircuit',
          'error',
          [{ kind: 'circuit', id: code }],
          { code },
        ),
      );
    }
  }

  const pointsWithoutCircuit: ValidationTarget[] = [];
  const pointsWithUnknownCircuit: ValidationTarget[] = [];
  const unknownPointCodes: string[] = [];

  for (const point of input.points) {
    const circuitId = point.properties.circuitId?.trim();

    if (!circuitId) {
      pointsWithoutCircuit.push({ kind: 'point', id: point.id });
    } else if (!circuitIds.has(circuitId)) {
      pointsWithUnknownCircuit.push({ kind: 'point', id: point.id });
      unknownPointCodes.push(circuitId);
    }
  }

  if (pointsWithoutCircuit.length > 0) {
    issues.push(issue('pointWithoutCircuit', 'warning', pointsWithoutCircuit));
  }

  if (pointsWithUnknownCircuit.length > 0) {
    issues.push(
      issue('pointUnknownCircuit', 'warning', pointsWithUnknownCircuit, {
        codes: unique(unknownPointCodes).join(', '),
      }),
    );
  }

  const routesWithoutCircuit: ValidationTarget[] = [];
  const routesWithUnknownCircuit: ValidationTarget[] = [];
  const routesWithUnknownMaterial: ValidationTarget[] = [];
  const unknownRouteCodes: string[] = [];
  const zeroLengthRoutes: ValidationTarget[] = [];
  const crossingRoutes: ValidationTarget[] = [];
  const looseEndRoutes: ValidationTarget[] = [];
  const missingPinRoutes: ValidationTarget[] = [];
  const mismatchedPinRoutes: ValidationTarget[] = [];
  const connectedPointIds = new Set<string>();
  const pointById = new Map(input.points.map((point) => [point.id, point]));

  for (const route of input.routes) {
    const circuitId = route.circuitId?.trim() ?? '';

    if (!circuitId) {
      routesWithoutCircuit.push({ kind: 'route', id: route.id });
    } else if (!circuitIds.has(circuitId)) {
      routesWithUnknownCircuit.push({ kind: 'route', id: route.id });
      unknownRouteCodes.push(circuitId);
    }

    if (
      materialIds &&
      route.materialId &&
      !materialIds.has(route.materialId)
    ) {
      routesWithUnknownMaterial.push({ kind: 'route', id: route.id });
    }

    for (const [end, pointId] of [
      ['start', route.startPointId],
      ['end', route.endPointId],
    ] as const) {
      if (!pointId) continue;
      const point = pointById.get(pointId);

      if (!point) {
        if (
          !missingPinRoutes.some(
            (target) => target.kind === 'route' && target.id === route.id,
          )
        ) {
          missingPinRoutes.push({ kind: 'route', id: route.id });
        }
        continue;
      }

      const at =
        end === 'start'
          ? route.geometry[0]
          : route.geometry[route.geometry.length - 1];

      if (at && !near(at, point, tolerance)) {
        mismatchedPinRoutes.push({ kind: 'route', id: route.id });
      }
    }

    if (route.geometry.length >= 2) {
      if (polylineLength(route.geometry) <= ENDPOINT_TOLERANCE) {
        zeroLengthRoutes.push({ kind: 'route', id: route.id });
      }

      const start = route.geometry[0];
      const end = route.geometry[route.geometry.length - 1];
      let connectedEnds = 0;

      for (const at of [start, end]) {
        if (!at) continue;

        const matches = input.points.filter((point) =>
          near(at, point, tolerance),
        );

        if (matches.length > 0) {
          connectedEnds += 1;
          for (const match of matches) connectedPointIds.add(match.id);
        }
      }

      if (connectedEnds < 2) {
        looseEndRoutes.push({ kind: 'route', id: route.id });
      }

      if (
        route.settings.mounting !== 'chase' &&
        findRoutePenetrations(
          { id: route.id, geometry: route.geometry },
          input.walls,
        ).length > 0
      ) {
        crossingRoutes.push({ kind: 'route', id: route.id });
      }
    }
  }

  if (routesWithoutCircuit.length > 0) {
    issues.push(issue('routeWithoutCircuit', 'warning', routesWithoutCircuit));
  }

  if (routesWithUnknownCircuit.length > 0) {
    issues.push(
      issue('routeUnknownCircuit', 'warning', routesWithUnknownCircuit, {
        codes: unique(unknownRouteCodes).join(', '),
      }),
    );
  }

  if (routesWithUnknownMaterial.length > 0) {
    issues.push(
      issue('routeUnknownMaterial', 'warning', routesWithUnknownMaterial),
    );
  }

  if (zeroLengthRoutes.length > 0) {
    issues.push(issue('routeZeroLength', 'error', zeroLengthRoutes));
  }

  if (looseEndRoutes.length > 0) {
    issues.push(issue('routeUnconnectedEnds', 'warning', looseEndRoutes));
  }

  if (crossingRoutes.length > 0) {
    issues.push(issue('routeCrossesWall', 'info', crossingRoutes));
  }

  if (missingPinRoutes.length > 0) {
    issues.push(issue('pinnedPointMissing', 'warning', missingPinRoutes));
  }

  if (mismatchedPinRoutes.length > 0) {
    issues.push(issue('pinnedEndMismatch', 'warning', mismatchedPinRoutes));
  }

  const isolatedPoints: ValidationTarget[] = input.points
    .filter((point) => !connectedPointIds.has(point.id))
    .map((point) => ({ kind: 'point', id: point.id }));

  if (isolatedPoints.length > 0) {
    issues.push(issue('isolatedPoint', 'warning', isolatedPoints));
  }

  const wallById = new Map(input.walls.map((wall) => [wall.id, wall]));
  const openingsOutside: ValidationTarget[] = [];
  const openingsMissingWall: ValidationTarget[] = [];

  for (const opening of input.openings) {
    const wall = wallById.get(opening.wallId);

    if (!wall) {
      openingsMissingWall.push({ kind: 'opening', id: opening.id });
      continue;
    }

    if (
      polylineLength(wall.geometry) + ENDPOINT_TOLERANCE <
      opening.offset + opening.width
    ) {
      openingsOutside.push({ kind: 'opening', id: opening.id });
    }
  }

  if (openingsOutside.length > 0) {
    issues.push(issue('openingOutsideWall', 'error', openingsOutside));
  }

  if (openingsMissingWall.length > 0) {
    issues.push(issue('openingMissingWall', 'error', openingsMissingWall));
  }

  const usedCircuits = new Set<string>();

  for (const point of input.points) {
    const id = point.properties.circuitId?.trim();
    if (id) usedCircuits.add(id);
  }

  for (const route of input.routes) {
    if (route.circuitId) usedCircuits.add(route.circuitId);
  }

  const unusedCircuits = input.circuits
    .filter((circuit) => !usedCircuits.has(circuit.id))
    .map((circuit) => ({ kind: 'circuit' as const, id: circuit.id }));

  if (unusedCircuits.length > 0) {
    issues.push(issue('unusedCircuit', 'info', unusedCircuits));
  }

  const circuitNames = new Map(
    input.circuits.map((circuit) => [
      circuit.id,
      circuit.name ?? circuit.id.slice(0, 8),
    ]),
  );
  const clashes = findClashes({
    routes: input.routes.map((route) => ({
      id: route.id,
      circuitId: route.circuitId,
      geometry: route.geometry,
      mounting: route.settings.mounting ?? null,
    })),
    points: input.points.map((point) => ({
      id: point.id,
      type: point.type,
      x: point.x,
      y: point.y,
      circuitId: point.properties.circuitId ?? null,
    })),
  });

  for (const clash of clashes) {
    if (clash.kind === 'route-route') {
      const route = input.routes.find((item) => item.id === clash.routeId);
      const other = input.routes.find((item) => item.id === clash.otherId);

      issues.push(
        issue(
          'routeClash',
          clash.severity,
          [
            { kind: 'route', id: clash.routeId },
            { kind: 'route', id: clash.otherId },
          ],
          {
            route: route?.circuitId
              ? (circuitNames.get(route.circuitId) ?? route.circuitId)
              : clash.routeId.slice(0, 8),
            other: other?.circuitId
              ? (circuitNames.get(other.circuitId) ?? other.circuitId)
              : clash.otherId.slice(0, 8),
          },
        ),
      );
    } else {
      const route = input.routes.find((item) => item.id === clash.routeId);

      issues.push(
        issue(
          'routePointClash',
          clash.severity,
          [
            { kind: 'route', id: clash.routeId },
            { kind: 'point', id: clash.otherId },
          ],
          {
            route: route?.circuitId
              ? (circuitNames.get(route.circuitId) ?? route.circuitId)
              : clash.routeId.slice(0, 8),
          },
        ),
      );
    }
  }

  for (const room of input.rooms ?? []) {
    if (!isWetRoomName(room.name)) continue;

    for (const point of input.points) {
      if (!pointInPolygon(point, room.boundary)) continue;

      if (point.type === 'socket') {
        const circuit = input.electrical?.circuits.find(
          (item) => item.id === point.properties.circuitId,
        );
        const rcd = circuit?.rcd ?? null;

        if (!rcd || rcd.sensitivityMa > 30) {
          issues.push(
            issue(
              'normWetZoneRcd',
              'error',
              [{ kind: 'point', id: point.id }],
              {
                room: room.name,
                circuit: point.properties.circuitId ?? '—',
                sensitivity: rcd?.sensitivityMa ?? 0,
              },
              'ПУЭ 7.1.79; ДБН В.2.5-23:2010, п. 8.5',
            ),
          );
        }
      }

      if (point.type === 'junction') {
        issues.push(
          issue(
            'normJunctionWetZone',
            'warning',
            [{ kind: 'point', id: point.id }],
            { room: room.name },
            'ПУЭ 7.1.48; ДБН В.2.5-23:2010, п. 8.5',
          ),
        );
      }
    }
  }

  for (const panelIssue of input.panelSchedule?.issues ?? []) {
    issues.push(
      issue(
        panelIssue.code,
        panelIssue.severity,
        [{ kind: 'panel' }],
        panelIssue.params,
        NORM_REFERENCES[panelIssue.code],
      ),
    );
  }

  for (const electricalIssue of input.electrical?.issues ?? []) {
    const target: ValidationTarget = electricalIssue.circuitId
      ? { kind: 'circuit', id: electricalIssue.circuitId }
      : { kind: 'calibration' };

    issues.push(
      issue(
        electricalIssue.code,
        electricalIssue.severity,
        [target],
        electricalIssue.params,
        NORM_REFERENCES[electricalIssue.code],
      ),
    );
  }

  return sortIssues(issues);
}

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const rank: Record<ValidationSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return [...issues].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] || a.code.localeCompare(b.code),
  );
}
