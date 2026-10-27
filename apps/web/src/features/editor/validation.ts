import {
  findClashes,
  findRoutePenetrations,
  polylineLength,
  type ElectricalIssueCode,
  type ElectricalPlanResult,
  type Point2D,
  type SignalingIssueCode,
  type SignalingTakeoff,
} from '@drawmyplace/calculations';
import {
  NORM_REFERENCES,
  SIGNALING_NORM_REFERENCES,
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
  | 'signalingPointWithoutLoop'
  | 'signalingUnknownLoop'
  | 'signalingDuplicateAddress'
  | 'signalingAddressOutOfRange'
  | 'signalingLoopDeviceOverflow'
  | 'signalingLoopLengthOverflow'
  | 'signalingVoltageDropHigh'
  | 'signalingIncompatiblePanel'
  | 'signalingFireCoverage'
  | 'signalingSirenCoverage'
  | 'signalingCameraBlindSpot'
  | 'signalingFireDetectorSpacing'
  | 'signalingFireDetectorWallDistance'
  | 'signalingSharedChase'
  | 'signalingFireCableNotFr'
  | 'signalingBatteryUndersized'
  | 'signalingPatchPanelOverflow'
  | 'signalingManualCallHeight'
  | ElectricalIssueCode;

export type ValidationTarget =
  | {
      kind:
        | 'point'
        | 'route'
        | 'wall'
        | 'opening'
        | 'room'
        | 'circuit'
        | 'loop';
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
  mountingHeight?: number | null;
  properties: {
    circuitId?: string | null;
    subtype?: string | null;
    productId?: string | null;
    loopId?: string | null;
    address?: number | null;
    zone?: number | null;
  };
}

export interface ValidationRoute {
  id: string;
  circuitId: string | null;
  materialId?: string | null;
  startPointId?: string | null;
  endPointId?: string | null;
  geometry: readonly Point2D[];
  settings: { mounting?: string; system?: string; loopId?: string | null };
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
  /** Signaling takeoff computed from the same plan; loop/coverage rules reuse it. */
  signaling?: SignalingTakeoff | null;
  signalingLoops?: readonly {
    id: string;
    code: string;
    type: string;
    panelId?: string | null;
    maxDevices?: number | null;
    maxLength?: number | null;
  }[];
  materials?: readonly { id: string; code: string; name: string }[];
  deviceProducts?: readonly {
    id: string;
    subtype: string;
    system?: string | null;
    compatibility?: string[];
    loopAddressable?: boolean;
  }[];
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
const SIGNALING_CODES: Record<SignalingIssueCode, ValidationCode> = {
  loopDeviceOverflow: 'signalingLoopDeviceOverflow',
  loopLengthOverflow: 'signalingLoopLengthOverflow',
  duplicateAddress: 'signalingDuplicateAddress',
  voltageDropHigh: 'signalingVoltageDropHigh',
  batteryUndersized: 'signalingBatteryUndersized',
  smokeCoverageMissing: 'signalingFireCoverage',
  sirenCoverageMissing: 'signalingSirenCoverage',
  cameraBlindSpot: 'signalingCameraBlindSpot',
  fireDetectorSpacing: 'signalingFireDetectorSpacing',
  fireDetectorWallDistance: 'signalingFireDetectorWallDistance',
  patchPanelOverflow: 'signalingPatchPanelOverflow',
  sharedChase: 'signalingSharedChase',
};

function segmentDistance(a: Point2D, b: Point2D, c: Point2D, d: Point2D) {
  const pointSegment = (p: Point2D, s: Point2D, e: Point2D) => {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const length = dx * dx + dy * dy;
    if (length < 1e-12) return Math.hypot(p.x - s.x, p.y - s.y);
    const t = Math.max(
      0,
      Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / length),
    );
    return Math.hypot(p.x - (s.x + t * dx), p.y - (s.y + t * dy));
  };

  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}

function polylinesNear(
  first: readonly Point2D[],
  second: readonly Point2D[],
  threshold: number,
): boolean {
  for (let i = 1; i < first.length; i += 1) {
    const a = first[i - 1];
    const b = first[i];
    if (!a || !b) continue;
    for (let j = 1; j < second.length; j += 1) {
      const c = second[j - 1];
      const d = second[j];
      if (!c || !d) continue;
      if (segmentDistance(a, b, c, d) <= threshold) return true;
    }
  }
  return false;
}

/** Fire/safety, loop, compatibility and separation rules for signaling. */
function signalingValidationIssues(input: ValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const loops = input.signalingLoops ?? [];
  const loopById = new Map(loops.map((loop) => [loop.id, loop]));
  const productById = new Map(
    (input.deviceProducts ?? []).map((product) => [product.id, product]),
  );
  const materialById = new Map(
    (input.materials ?? []).map((material) => [material.id, material]),
  );
  const signalingSubtypes = new Set(
    (input.deviceProducts ?? [])
      .filter((product) => product.system && product.system !== 'power')
      .map((product) => product.subtype),
  );
  const missingLoop: ValidationTarget[] = [];
  const unknownLoop: ValidationTarget[] = [];
  const addressOutOfRange: ValidationTarget[] = [];
  const manualCallHeight: ValidationTarget[] = [];
  const addressesByLoop = new Map<string, { address: number; points: string[] }>();

  for (const point of input.points) {
    const properties = point.properties;
    const product = properties.productId
      ? productById.get(properties.productId)
      : undefined;
    const isSignaling =
      Boolean(properties.loopId) ||
      Boolean(
        properties.subtype && signalingSubtypes.has(properties.subtype),
      ) ||
      Boolean(product?.system && product.system !== 'power');

    if (isSignaling && !properties.loopId) {
      missingLoop.push({ kind: 'point', id: point.id });
    }
    if (properties.loopId && !loopById.has(properties.loopId)) {
      unknownLoop.push({ kind: 'point', id: point.id });
    }
    if (
      typeof properties.address === 'number' &&
      (properties.address < 0 || properties.address > 254)
    ) {
      addressOutOfRange.push({ kind: 'point', id: point.id });
    }
    if (
      properties.loopId &&
      typeof properties.address === 'number' &&
      properties.address >= 0 &&
      properties.address <= 254
    ) {
      const key = `${properties.loopId}:${properties.address}`;
      const entry = addressesByLoop.get(key) ?? {
        address: properties.address,
        points: [],
      };
      entry.points.push(point.id);
      addressesByLoop.set(key, entry);
    }
    if (
      properties.subtype === 'manual-call-point' &&
      typeof point.mountingHeight === 'number' &&
      (point.mountingHeight < 0.8 || point.mountingHeight > 1.5)
    ) {
      manualCallHeight.push({ kind: 'point', id: point.id });
    }
  }

  if (missingLoop.length > 0) {
    issues.push(
      issue(
        'signalingPointWithoutLoop',
        'warning',
        missingLoop,
        undefined,
        SIGNALING_NORM_REFERENCES.pointWithoutLoop,
      ),
    );
  }
  if (unknownLoop.length > 0) {
    issues.push(
      issue(
        'signalingUnknownLoop',
        'error',
        unknownLoop,
        undefined,
        SIGNALING_NORM_REFERENCES.unknownLoop,
      ),
    );
  }
  if (addressOutOfRange.length > 0) {
    issues.push(
      issue(
        'signalingAddressOutOfRange',
        'error',
        addressOutOfRange,
        undefined,
        SIGNALING_NORM_REFERENCES.addressOutOfRange,
      ),
    );
  }
  for (const entry of addressesByLoop.values()) {
    if (entry.points.length > 1) {
      issues.push(
        issue(
          'signalingDuplicateAddress',
          'error',
          entry.points.map((id) => ({ kind: 'point', id })),
          { address: entry.address },
          SIGNALING_NORM_REFERENCES.duplicateAddress,
        ),
      );
    }
  }
  if (manualCallHeight.length > 0) {
    issues.push(
      issue(
        'signalingManualCallHeight',
        'warning',
        manualCallHeight,
        undefined,
        SIGNALING_NORM_REFERENCES.manualCallHeight,
      ),
    );
  }

  const panelByLoop = new Map<string, string>();
  for (const loop of loops) {
    if (loop.panelId) panelByLoop.set(loop.id, loop.panelId);
  }
  const incompatible: ValidationTarget[] = [];

  for (const point of input.points) {
    const loopId = point.properties.loopId;
    const productId = point.properties.productId;
    if (!loopId || !productId) continue;
    const product = productById.get(productId);
    if (!product?.compatibility || product.compatibility.length === 0) continue;
    const panelPointId = panelByLoop.get(loopId);
    const panelProductId = panelPointId
      ? input.points.find((item) => item.id === panelPointId)?.properties
          .productId
      : null;
    if (!panelProductId) continue;
    if (!product.compatibility.includes(panelProductId)) {
      incompatible.push({ kind: 'point', id: point.id });
    }
  }
  if (incompatible.length > 0) {
    issues.push(
      issue(
        'signalingIncompatiblePanel',
        'error',
        incompatible,
        undefined,
        SIGNALING_NORM_REFERENCES.incompatiblePanel,
      ),
    );
  }

  const fireLoopIds = new Set(
    loops
      .filter((loop) => loop.type === 'fire' || loop.type === 'combined')
      .map((loop) => loop.id),
  );
  const nonFrRoutes: ValidationTarget[] = [];
  for (const route of input.routes) {
    const loopId = route.settings.loopId;
    if (!loopId || !fireLoopIds.has(loopId)) continue;
    if (!route.materialId) continue;
    const material = materialById.get(route.materialId);
    const label = `${material?.code ?? ''} ${material?.name ?? ''}`.toLowerCase();
    if (!/(^|\b)(fr|fire|нг|вогне)/i.test(label)) {
      nonFrRoutes.push({ kind: 'route', id: route.id });
    }
  }
  if (nonFrRoutes.length > 0) {
    issues.push(
      issue(
        'signalingFireCableNotFr',
        'error',
        nonFrRoutes,
        undefined,
        SIGNALING_NORM_REFERENCES.fireCableNotFr,
      ),
    );
  }

  const threshold = input.calibration?.metersPerUnit
    ? 0.05 / input.calibration.metersPerUnit
    : 0.1;
  const powerChases = input.routes.filter(
    (route) =>
      route.settings.mounting === 'chase' &&
      (route.settings.system ?? 'power') === 'power',
  );
  const sharedChase: ValidationTarget[] = [];
  if (powerChases.length > 0) {
    for (const route of input.routes) {
      const system = route.settings.system ?? 'power';
      if (system === 'power' || route.settings.mounting !== 'chase') continue;
      if (
        powerChases.some(
          (power) =>
            power.id !== route.id &&
            polylinesNear(route.geometry, power.geometry, threshold),
        )
      ) {
        sharedChase.push({ kind: 'route', id: route.id });
      }
    }
  }
  if (sharedChase.length > 0) {
    issues.push(
      issue(
        'signalingSharedChase',
        'warning',
        sharedChase,
        undefined,
        SIGNALING_NORM_REFERENCES.sharedChase,
      ),
    );
  }

  for (const takeoffIssue of input.signaling?.issues ?? []) {
    if (takeoffIssue.code === 'duplicateAddress') continue;
    const code = SIGNALING_CODES[takeoffIssue.code];
    if (!code) continue;
    const target: ValidationTarget = takeoffIssue.pointId
      ? { kind: 'point', id: takeoffIssue.pointId }
      : takeoffIssue.loopId
          ? { kind: 'loop', id: takeoffIssue.loopId }
          : takeoffIssue.roomId
            ? { kind: 'room', id: takeoffIssue.roomId }
            : { kind: 'panel' };

    issues.push(
      issue(
        code,
        takeoffIssue.severity,
        [target],
        takeoffIssue.params,
        SIGNALING_NORM_REFERENCES[takeoffIssue.code],
      ),
    );
  }

  return issues;
}

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

  issues.push(...signalingValidationIssues(input));

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
