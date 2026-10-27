import type { Point2D } from './geometry';
import { polylineLength } from './geometry';

export type SignalingSystem =
  | 'power'
  | 'security'
  | 'fire'
  | 'access'
  | 'cctv'
  | 'pa'
  | 'data';

export interface SignalingLoopInput {
  id: string;
  code: string;
  name: string;
  type: 'security' | 'fire' | 'combined' | 'access' | 'cctv' | 'pa';
  topology?: 'radial' | 'loop' | 'bus';
  voltageV?: number | null;
  maxLength?: number | null;
  maxDevices?: number | null;
}

export interface SignalingPointInput {
  id: string;
  subtype?: string | null;
  loopId?: string | null;
  address?: number | null;
  zone?: number | null;
  x?: number;
  y?: number;
  system?: SignalingSystem | null;
  standbyA?: number | null;
  alarmA?: number | null;
  coverageAreaM2?: number | null;
  coverageRadiusM?: number | null;
  loopAddressable?: boolean | null;
  productId?: string | null;
}

export interface SignalingRouteInput {
  id: string;
  system?: SignalingSystem | null;
  loopId?: string | null;
  mounting?: string | null;
  geometry: readonly Point2D[];
  requiredLength?: number | null;
}

export interface SignalingRoomInput {
  id: string;
  name: string;
  boundary: readonly Point2D[];
}

export interface SignalingLoopResult {
  id: string;
  code: string;
  name: string;
  type: SignalingLoopInput['type'];
  deviceCount: number;
  addresses: number[];
  duplicateAddresses: number[];
  cableMeters: number;
  standbyA: number;
  alarmA: number;
  voltageV: number;
  voltageDropPercent: number;
  maxDevices: number | null;
  maxLength: number | null;
  status: 'ok' | 'warning' | 'error';
  issues: SignalingIssue[];
}

export type SignalingIssueCode =
  | 'loopDeviceOverflow'
  | 'loopLengthOverflow'
  | 'duplicateAddress'
  | 'voltageDropHigh'
  | 'batteryUndersized'
  | 'smokeCoverageMissing'
  | 'sirenCoverageMissing'
  | 'cameraBlindSpot'
  | 'patchPanelOverflow'
  | 'sharedChase';

export interface SignalingIssue {
  code: SignalingIssueCode;
  severity: 'warning' | 'error';
  loopId?: string;
  pointId?: string;
  roomId?: string;
  params?: Record<string, string | number>;
}

export interface SignalingTakeoffInput {
  loops: readonly SignalingLoopInput[];
  points: readonly SignalingPointInput[];
  routes: readonly SignalingRouteInput[];
  rooms?: readonly SignalingRoomInput[];
  metersPerUnit: number | null;
}

export interface SignalingTakeoff {
  loops: SignalingLoopResult[];
  totalDevices: number;
  totalCableMeters: number;
  standbyA: number;
  alarmA: number;
  battery: {
    requiredAh: number;
    recommendedAh: number;
    standbyHours: number;
    alarmMinutes: number;
    batteries: number;
  };
  fire: {
    detectors: number;
    uncoveredRooms: string[];
  };
  cctv: {
    cameras: number;
    archiveGbPerDay: number;
    blindSpotRooms: string[];
  };
  scs: {
    ports: number;
    patchPanels: number;
    switches: number;
    longestRunMeters: number;
  };
  issues: SignalingIssue[];
}

const DEFAULT_VOLTAGE_V = 24;
const DEFAULT_MAX_DEVICES = 128;
const DEFAULT_MAX_LENGTH_M = 500;
const MAX_VOLTAGE_DROP_PERCENT = 10;
const BATTERY_STANDBY_HOURS = 24;
const BATTERY_ALARM_MINUTES = 5;
/** Loop cable resistance per metre (both directions) for a 1.5 mm² pair. */
const LOOP_RESISTANCE_OHM_PER_M = 0.024;
const BATTERY_SIZES_AH = [2, 7, 12, 18, 26, 40, 65, 100];
const SMOKE_COVERAGE_M2 = 85;
const CCTV_ARCHIVE_GB_PER_DAY = 42;
const PATCH_PANEL_PORTS = 24;

function polylineMeters(
  geometry: readonly Point2D[],
  metersPerUnit: number | null,
): number {
  const units = polylineLength(geometry);
  return metersPerUnit !== null && metersPerUnit > 0
    ? units * metersPerUnit
    : 0;
}

function polygonArea(points: readonly Point2D[]): number {
  if (points.length < 3) return 0;
  let sum = 0;

  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }

  return Math.abs(sum) / 2;
}

function pointInPolygon(
  point: { x: number; y: number },
  polygon: readonly Point2D[],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-12) + a.x;

    if (intersects) inside = !inside;
  }

  return inside;
}

function nextBatterySize(requiredAh: number): number {
  return (
    BATTERY_SIZES_AH.find((size) => size >= requiredAh) ??
    BATTERY_SIZES_AH[BATTERY_SIZES_AH.length - 1]!
  );
}

function isDetectionSubtype(subtype: string | null | undefined): boolean {
  return (
    subtype === 'smoke-detector' ||
    subtype === 'heat-detector' ||
    subtype === 'smoke-heat-detector'
  );
}

function isSirenSubtype(subtype: string | null | undefined): boolean {
  return (
    subtype === 'siren-internal' ||
    subtype === 'siren-external' ||
    subtype === 'strobe' ||
    subtype === 'voice-alarm'
  );
}

function isCameraSubtype(subtype: string | null | undefined): boolean {
  return subtype === 'ip-camera';
}

/**
 * Signaling / low-current takeoff: loop device counts, cable, current, voltage
 * drop, battery capacity, fire detector coverage, CCTV and SCS quantities.
 * It is pure so the same numbers are used by the editor, validation and reports.
 */
export function buildSignalingTakeoff(
  input: SignalingTakeoffInput,
): SignalingTakeoff {
  const issues: SignalingIssue[] = [];
  const metersPerUnit = input.metersPerUnit;
  const pointsByLoop = new Map<string, SignalingPointInput[]>();

  for (const point of input.points) {
    if (!point.loopId) continue;
    const list = pointsByLoop.get(point.loopId) ?? [];
    list.push(point);
    pointsByLoop.set(point.loopId, list);
  }

  const results: SignalingLoopResult[] = input.loops.map((loop) => {
    const points = pointsByLoop.get(loop.id) ?? [];
    const addresses = points
      .map((point) => point.address)
      .filter((address): address is number => typeof address === 'number')
      .sort((a, b) => a - b);
    const seen = new Set<number>();
    const duplicateAddresses = new Set<number>();

    for (const address of addresses) {
      if (seen.has(address)) duplicateAddresses.add(address);
      seen.add(address);
    }

    const routes = input.routes.filter((route) => {
      if (route.loopId) return route.loopId === loop.id;
      return (
        !route.loopId &&
        route.system === loop.type &&
        input.loops.filter((item) => item.type === loop.type).length === 1
      );
    });
    const cableMeters = routes.reduce((sum, route) => {
      return (
        sum +
        (typeof route.requiredLength === 'number'
          ? route.requiredLength
          : polylineMeters(route.geometry, metersPerUnit))
      );
    }, 0);
    const standbyA = points.reduce(
      (sum, point) => sum + (point.standbyA ?? 0),
      0,
    );
    const alarmA = points.reduce((sum, point) => sum + (point.alarmA ?? 0), 0);
    const voltageV = loop.voltageV ?? DEFAULT_VOLTAGE_V;
    const voltageDropPercent =
      voltageV > 0
        ? (alarmA * cableMeters * LOOP_RESISTANCE_OHM_PER_M * 2 * 100) /
          voltageV
        : 0;
    const maxDevices = loop.maxDevices ?? DEFAULT_MAX_DEVICES;
    const maxLength = loop.maxLength ?? DEFAULT_MAX_LENGTH_M;
    const loopIssues: SignalingIssue[] = [];

    if (points.length > maxDevices) {
      loopIssues.push({
        code: 'loopDeviceOverflow',
        severity: 'error',
        loopId: loop.id,
        params: { count: points.length, max: maxDevices },
      });
    }
    if (cableMeters > maxLength) {
      loopIssues.push({
        code: 'loopLengthOverflow',
        severity: 'error',
        loopId: loop.id,
        params: { length: cableMeters, max: maxLength },
      });
    }
    for (const address of duplicateAddresses) {
      loopIssues.push({
        code: 'duplicateAddress',
        severity: 'error',
        loopId: loop.id,
        params: { address },
      });
    }
    if (voltageDropPercent > MAX_VOLTAGE_DROP_PERCENT) {
      loopIssues.push({
        code: 'voltageDropHigh',
        severity: 'warning',
        loopId: loop.id,
        params: {
          drop: Math.round(voltageDropPercent * 10) / 10,
          max: MAX_VOLTAGE_DROP_PERCENT,
        },
      });
    }
    issues.push(...loopIssues);

    return {
      id: loop.id,
      code: loop.code,
      name: loop.name,
      type: loop.type,
      deviceCount: points.length,
      addresses,
      duplicateAddresses: [...duplicateAddresses],
      cableMeters: Math.round(cableMeters * 100) / 100,
      standbyA,
      alarmA,
      voltageV,
      voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
      maxDevices,
      maxLength,
      status: loopIssues.some((issue) => issue.severity === 'error')
        ? 'error'
        : loopIssues.length > 0
          ? 'warning'
          : 'ok',
      issues: loopIssues,
    };
  });

  const standbyA = results.reduce((sum, loop) => sum + loop.standbyA, 0);
  const alarmA = results.reduce((sum, loop) => sum + loop.alarmA, 0);
  const requiredAh =
    (standbyA * BATTERY_STANDBY_HOURS +
      alarmA * (BATTERY_ALARM_MINUTES / 60)) *
    1.25;
  const recommendedAh = nextBatterySize(requiredAh);

  if (requiredAh > 7) {
    issues.push({
      code: 'batteryUndersized',
      severity: 'warning',
      params: {
        required: Math.round(requiredAh * 100) / 100,
        recommended: recommendedAh,
      },
    });
  }

  const rooms = input.rooms ?? [];
  const firePoints = input.points.filter((point) =>
    isDetectionSubtype(point.subtype),
  );
  const uncoveredRooms: string[] = [];

  for (const room of rooms) {
    const area = metersPerUnit
      ? polygonArea(room.boundary) * metersPerUnit * metersPerUnit
      : 0;
    if (area <= 0) continue;
    const detectors = firePoints.filter(
      (point) =>
        typeof point.x === 'number' &&
        typeof point.y === 'number' &&
        pointInPolygon({ x: point.x, y: point.y }, room.boundary),
    );
    const coverage = Math.max(
      SMOKE_COVERAGE_M2,
      ...detectors.map((point) => point.coverageAreaM2 ?? SMOKE_COVERAGE_M2),
    );
    const required = Math.max(1, Math.ceil(area / coverage));

    if (detectors.length < required) {
      uncoveredRooms.push(room.name);
      issues.push({
        code: 'smokeCoverageMissing',
        severity: 'warning',
        roomId: room.id,
        params: {
          room: room.name,
          required,
          actual: detectors.length,
        },
      });
    }

    const sirens = input.points.filter(
      (point) =>
        isSirenSubtype(point.subtype) &&
        typeof point.x === 'number' &&
        typeof point.y === 'number' &&
        pointInPolygon({ x: point.x, y: point.y }, room.boundary),
    );

    if (sirens.length === 0) {
      issues.push({
        code: 'sirenCoverageMissing',
        severity: 'warning',
        roomId: room.id,
        params: { room: room.name },
      });
    }
  }

  const cameras = input.points.filter((point) =>
    isCameraSubtype(point.subtype),
  );
  const blindSpotRooms: string[] = [];

  for (const room of rooms) {
    const area = metersPerUnit
      ? polygonArea(room.boundary) * metersPerUnit * metersPerUnit
      : 0;
    if (area <= 20) continue;
    const covered = cameras.some(
      (camera) =>
        typeof camera.x === 'number' &&
        typeof camera.y === 'number' &&
        pointInPolygon({ x: camera.x, y: camera.y }, room.boundary),
    );

    if (!covered) {
      blindSpotRooms.push(room.name);
      issues.push({
        code: 'cameraBlindSpot',
        severity: 'warning',
        roomId: room.id,
        params: { room: room.name },
      });
    }
  }

  const ports = input.points.filter(
    (point) =>
      point.subtype === 'data-lan' ||
      point.subtype === 'data-smart-home' ||
      point.subtype === 'data-camera',
  ).length;
  const patchPanels = input.points.filter(
    (point) => point.subtype === 'patch-panel',
  ).length;
  const switches = input.points.filter(
    (point) => point.subtype === 'network-switch',
  ).length;
  const dataRoutes = input.routes.filter((route) => route.system === 'data');
  const longestRunMeters = dataRoutes.reduce((longest, route) => {
    const length =
      route.requiredLength ?? polylineMeters(route.geometry, metersPerUnit);
    return Math.max(longest, length);
  }, 0);
  const capacity = Math.max(PATCH_PANEL_PORTS, patchPanels * PATCH_PANEL_PORTS);

  if (ports > capacity) {
    issues.push({
      code: 'patchPanelOverflow',
      severity: 'warning',
      params: { ports, capacity },
    });
  }

  return {
    loops: results,
    totalDevices: results.reduce((sum, loop) => sum + loop.deviceCount, 0),
    totalCableMeters:
      Math.round(
        results.reduce((sum, loop) => sum + loop.cableMeters, 0) * 100,
      ) / 100,
    standbyA,
    alarmA,
    battery: {
      requiredAh: Math.round(requiredAh * 100) / 100,
      recommendedAh,
      standbyHours: BATTERY_STANDBY_HOURS,
      alarmMinutes: BATTERY_ALARM_MINUTES,
      batteries: Math.max(1, Math.ceil(recommendedAh / 7)),
    },
    fire: {
      detectors: firePoints.length,
      uncoveredRooms,
    },
    cctv: {
      cameras: cameras.length,
      archiveGbPerDay: cameras.length * CCTV_ARCHIVE_GB_PER_DAY,
      blindSpotRooms,
    },
    scs: {
      ports,
      patchPanels,
      switches,
      longestRunMeters: Math.round(longestRunMeters * 100) / 100,
    },
    issues,
  };
}
