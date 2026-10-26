import type {
  Circuit,
  ElectricalSettings,
  PublicPoint,
  PublicRoute,
} from '@drawmyplace/contracts';
import {
  calculateElectrical,
  normalizeElectricalSettings,
  type ElectricalPlanResult,
} from '@drawmyplace/calculations';

export interface ElectricalPlanInput {
  circuits: readonly Circuit[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  /** Required length by route id; null while a route cannot be calculated. */
  routeLengths: ReadonlyMap<string, number | null>;
  settings?: ElectricalSettings | null;
  calibrated: boolean;
}

/** Total required cable length per circuit, meters. */
export function circuitRouteLengths(
  routes: readonly Pick<PublicRoute, 'id' | 'circuitId'>[],
  routeLengths: ReadonlyMap<string, number | null>,
): Record<string, number> {
  const lengths: Record<string, number> = {};

  for (const route of routes) {
    if (!route.circuitId) continue;
    const length = routeLengths.get(route.id) ?? 0;
    lengths[route.circuitId] = (lengths[route.circuitId] ?? 0) + length;
  }

  return lengths;
}

/**
 * Joins the plan drawing with the persisted electrical settings and runs the
 * load / voltage-drop / protection calculation used by the editor panel and
 * the validation rules.
 */
export function buildElectricalPlan(input: ElectricalPlanInput): ElectricalPlanResult {
  const lengthsByCircuit = circuitRouteLengths(input.routes, input.routeLengths);

  return calculateElectrical({
    circuits: input.circuits.map((circuit) => ({
      id: circuit.id,
      name: circuit.name,
    })),
    devices: input.points.map((point) => ({
      id: point.id,
      circuitId: point.properties.circuitId ?? null,
      subtype: point.properties.subtype ?? null,
      type: point.type,
    })),
    settings: input.settings ?? null,
    lengthsByCircuit,
    calibrated: input.calibrated,
  });
}

export function resolvedElectricalSettings(
  settings?: ElectricalSettings | null,
): ElectricalSettings {
  return normalizeElectricalSettings(
    settings as Parameters<typeof normalizeElectricalSettings>[0],
  ) as ElectricalSettings;
}
