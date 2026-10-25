import { roundTo } from './geometry';

export interface PurchaseRule {
  /** Purchase in multiples of this size (1 = whole meters, 100 = 100 m coil). */
  step: number;
  /** Minimum purchasable quantity; 0 for none. */
  minimum?: number;
}

export const WHOLE_METERS: PurchaseRule = { step: 1 };

/**
 * Round a required quantity UP to the purchase step. Binary noise
 * (33.00000000000001) is removed first so exact values are not bumped a step.
 */
export function purchaseQuantity(required: number, rule: PurchaseRule): number {
  if (!Number.isFinite(required) || required < 0) {
    throw new RangeError('required must be a non-negative finite number');
  }
  if (!Number.isFinite(rule.step) || rule.step <= 0) {
    throw new RangeError('step must be a positive finite number');
  }
  if (required === 0) return 0;
  const steps = Math.ceil(roundTo(required / rule.step, 9));
  return roundTo(Math.max(steps * rule.step, rule.minimum ?? 0));
}

export interface MaterialLength {
  materialId: string | null;
  requiredLength: number;
}

export interface MaterialTotal {
  materialId: string | null;
  /** Sum of unrounded required lengths of all routes of this material. */
  requiredLength: number;
}

/**
 * Sums required lengths per material. Purchase rounding must be applied to the
 * total, not per route, otherwise every route is rounded up separately.
 */
export function totalByMaterial(
  lengths: readonly MaterialLength[],
): MaterialTotal[] {
  const map = new Map<string | null, number>();
  for (const l of lengths) {
    map.set(l.materialId, (map.get(l.materialId) ?? 0) + l.requiredLength);
  }
  return [...map].map(([materialId, total]) => ({
    materialId,
    requiredLength: roundTo(total),
  }));
}
