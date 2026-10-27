import type {
  Circuit,
  PlanCalculation,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  SignalingLoop,
  SignalingSettings,
} from '@drawmyplace/contracts';
import {
  buildSignalingTakeoff,
  type SignalingPointInput,
  type SignalingRouteInput,
  type SignalingSystem,
  type SignalingTakeoff,
} from '@drawmyplace/calculations';
import { deviceProduct } from '@drawmyplace/contracts';

export const SIGNALING_SUBTYPES = new Set([
  'smoke-detector',
  'heat-detector',
  'smoke-heat-detector',
  'door-contact',
  'glass-break',
  'water-leak',
  'vibration-detector',
  'loop-expander',
  'motion-sensor',
  'siren-internal',
  'siren-external',
  'strobe',
  'exit-sign',
  'voice-alarm',
  'fire-panel',
  'keypad',
  'card-reader',
  'relay-module',
  'power-supply',
  'battery',
  'gsm-communicator',
  'dialer',
  'patch-panel',
  'network-switch',
  'ip-camera',
  'nvr',
]);

const SYSTEM_BY_SUBTYPE: Record<string, SignalingSystem> = {
  'smoke-detector': 'fire',
  'heat-detector': 'fire',
  'smoke-heat-detector': 'fire',
  'siren-internal': 'fire',
  'siren-external': 'fire',
  strobe: 'fire',
  'exit-sign': 'fire',
  'voice-alarm': 'pa',
  'fire-panel': 'fire',
  'loop-expander': 'fire',
  'relay-module': 'fire',
  'power-supply': 'fire',
  battery: 'fire',
  'door-contact': 'security',
  'glass-break': 'security',
  'water-leak': 'security',
  'vibration-detector': 'security',
  'motion-sensor': 'security',
  keypad: 'security',
  'card-reader': 'access',
  'gsm-communicator': 'security',
  dialer: 'security',
  'patch-panel': 'data',
  'network-switch': 'data',
  'ip-camera': 'cctv',
  nvr: 'cctv',
};

const DEFAULTS: Record<
  string,
  { standbyA: number; alarmA: number; coverageAreaM2?: number; radiusM?: number }
> = {
  'smoke-detector': { standbyA: 0.0004, alarmA: 0.003, coverageAreaM2: 85 },
  'heat-detector': { standbyA: 0.00035, alarmA: 0.003, coverageAreaM2: 50 },
  'smoke-heat-detector': { standbyA: 0.0004, alarmA: 0.0035, coverageAreaM2: 85 },
  'siren-internal': { standbyA: 0, alarmA: 0.025, radiusM: 12 },
  'siren-external': { standbyA: 0, alarmA: 0.04, radiusM: 18 },
  strobe: { standbyA: 0, alarmA: 0.018, radiusM: 7.5 },
  'motion-sensor': { standbyA: 0.00002, alarmA: 0.00003, radiusM: 10 },
  'door-contact': { standbyA: 0.00001, alarmA: 0.00002 },
  'ip-camera': { standbyA: 0.004, alarmA: 0.006, radiusM: 15 },
  keypad: { standbyA: 0.035, alarmA: 0.04 },
  'fire-panel': { standbyA: 0.09, alarmA: 0.32 },
};

export function signalingSystemForSubtype(
  subtype: string | null | undefined,
): SignalingSystem | null {
  return subtype ? (SYSTEM_BY_SUBTYPE[subtype] ?? null) : null;
}

export function isSignalingPoint(point: PublicPoint): boolean {
  return Boolean(
    point.properties.loopId ||
      (point.properties.subtype &&
        SIGNALING_SUBTYPES.has(point.properties.subtype)),
  );
}

export function signalingSettings(plan: {
  calculationSettings?: { signaling?: SignalingSettings } | null;
}): SignalingSettings {
  return {
    loops: plan.calculationSettings?.signaling?.loops ?? [],
  };
}

export function signalingLoopForSystem(
  loops: readonly SignalingLoop[],
  system: SignalingSystem | null | undefined,
): SignalingLoop | null {
  if (!system) return null;
  const type = system === 'access' ? 'access' : system;
  return loops.find((loop) => loop.type === type) ?? null;
}

export interface SignalingSourceInput {
  loops: readonly SignalingLoop[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  rooms?: readonly PublicRoom[];
  metersPerUnit: number | null;
  calculation?: PlanCalculation | null;
  circuits?: readonly Circuit[];
}

export function buildSignalingModel(
  input: SignalingSourceInput,
): SignalingTakeoff {
  const routeLengths = new Map(
    (input.calculation?.routes ?? []).map((route) => [
      route.routeId,
      route.requiredLength,
    ]),
  );
  const points: SignalingPointInput[] = input.points.map((point) => {
    const product = deviceProduct(point.properties.productId);
    const subtype = point.properties.subtype ?? null;
    const fallback = subtype ? DEFAULTS[subtype] : undefined;
    const system =
      product?.system ?? signalingSystemForSubtype(subtype) ?? null;

    return {
      id: point.id,
      subtype,
      loopId: point.properties.loopId ?? null,
      address: point.properties.address ?? null,
      zone: point.properties.zone ?? null,
      x: point.x,
      y: point.y,
      system,
      standbyA: product?.currentStandbyA ?? fallback?.standbyA ?? 0,
      alarmA: product?.currentAlarmA ?? fallback?.alarmA ?? 0,
      coverageAreaM2: product?.coverageAreaM2 ?? fallback?.coverageAreaM2,
      coverageRadiusM: product?.coverageRadiusM ?? fallback?.radiusM,
      coverageAngleDeg: product?.coverageAngleDeg ?? null,
      rotation: point.rotation,
      loopAddressable: product?.loopAddressable ?? false,
      productId: point.properties.productId ?? null,
    };
  });
  const routes: SignalingRouteInput[] = input.routes.map((route) => ({
    id: route.id,
    system: (route.settings.system as SignalingSystem | undefined) ?? 'power',
    loopId: route.settings.loopId ?? null,
    mounting: route.settings.mounting ?? null,
    geometry: route.geometry,
    requiredLength: routeLengths.get(route.id) ?? null,
  }));

  return buildSignalingTakeoff({
    loops: input.loops,
    points,
    routes,
    rooms: input.rooms,
    metersPerUnit: input.metersPerUnit,
  });
}

export const SIGNALING_SYSTEM_OPTIONS: SignalingSystem[] = [
  'power',
  'security',
  'fire',
  'cctv',
  'pa',
  'data',
];
