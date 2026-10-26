import type { Circuit } from '@drawmyplace/contracts';
import type { ElectricalPlanResult } from '@drawmyplace/calculations';

export interface CircuitNumberingEntry {
  circuitId: string;
  name: string;
  /** Board tag, Q1 for the first (only) board. */
  boardTag: string;
  /** Breaker tag, e.g. QF1. */
  breakerTag: string;
  /** Cable/wire tag, e.g. W1. */
  wireTag: string;
  /** Terminal tag, e.g. X1:1. */
  terminalTag: string;
  /** Full circuit address, e.g. Q1-1L1. */
  address: string;
  phase: string;
}

export interface CircuitNumbering {
  boardTag: string;
  circuits: Record<string, CircuitNumberingEntry>;
}

export const DEFAULT_BOARD_TAG = 'Q1';

/**
 * Deterministic numbering for circuits, breakers, wires and terminals. It is
 * derived from the current circuit order and phases, so any plan edit that
 * reorders circuits automatically updates every exported document.
 */
export function buildCircuitNumbering(
  circuits: readonly Circuit[],
  electrical?: ElectricalPlanResult | null,
  boardTag = DEFAULT_BOARD_TAG,
): CircuitNumbering {
  const phases = new Map(
    (electrical?.circuits ?? []).map((circuit) => [circuit.id, circuit.phase]),
  );
  const entries: Record<string, CircuitNumberingEntry> = {};

  circuits.forEach((circuit, index) => {
    const number = index + 1;
    const phase = phases.get(circuit.id) ?? 'L1';

    entries[circuit.id] = {
      circuitId: circuit.id,
      name: circuit.name,
      boardTag,
      breakerTag: `QF${number}`,
      wireTag: `W${number}`,
      terminalTag: `X1:${number}`,
      address: `${boardTag}-${number}${phase}`,
      phase,
    };
  });

  return { boardTag, circuits: entries };
}

export function numberingFor(
  numbering: CircuitNumbering,
  circuitId: string | null | undefined,
): CircuitNumberingEntry | null {
  if (!circuitId) return null;
  return numbering.circuits[circuitId] ?? null;
}
