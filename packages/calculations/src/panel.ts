import {
  type BreakerSettings,
  type CableSettings,
  type ElectricalIssue,
  type ElectricalPlanResult,
  type PanelBoardSettings,
  type RcdSettings,
} from './electrical';

export type PanelStatus = 'ok' | 'warning' | 'error';

export interface PanelScheduleRow {
  way: number;
  row: number;
  moduleWidth: number;
  circuitId: string;
  name: string;
  phase: string;
  breaker: BreakerSettings;
  rcd: RcdSettings | null;
  cable: CableSettings;
  demandPowerW: number;
  currentA: number;
  voltageDropPercent: number;
  status: PanelStatus;
}

export type PanelIssueCode =
  | 'panelOverflow'
  | 'panelNearlyFull'
  | 'mainBreakerUndersized';

export interface PanelIssue {
  code: PanelIssueCode;
  severity: 'error' | 'warning';
  params?: Record<string, string | number>;
}

export interface PanelSchedule {
  board: PanelBoardSettings;
  rows: PanelScheduleRow[];
  totalWays: number;
  usedWays: number;
  reserveWays: number;
  fillPercent: number;
  issues: PanelIssue[];
}

function rowStatus(
  circuitId: string,
  issues: readonly ElectricalIssue[],
): PanelStatus {
  const scoped = issues.filter((issue) => issue.circuitId === circuitId);

  if (scoped.some((issue) => issue.severity === 'error')) return 'error';
  if (scoped.some((issue) => issue.severity === 'warning')) return 'warning';
  return 'ok';
}

/**
 * Lays out a panel schedule from the electrical calculation. A device occupies
 * the widest of its breaker and RCD modular widths (e.g. a 1P breaker with a
 * 2P RCD occupies two ways).
 */
export function buildPanelSchedule(
  electrical: ElectricalPlanResult,
): PanelSchedule {
  const board = electrical.settings.board;
  const totalWays = board.rows * board.waysPerRow;
  let nextWay = 1;
  const rows: PanelScheduleRow[] = [];

  for (const circuit of electrical.circuits) {
    const moduleWidth = Math.max(
      1,
      circuit.breaker.poles,
      circuit.rcd?.poles ?? 0,
    );

    rows.push({
      way: nextWay,
      row: Math.ceil(nextWay / board.waysPerRow),
      moduleWidth,
      circuitId: circuit.id,
      name: circuit.name,
      phase: circuit.phase,
      breaker: circuit.breaker,
      rcd: circuit.rcd,
      cable: circuit.cable,
      demandPowerW: circuit.demandPowerW,
      currentA: circuit.currentA,
      voltageDropPercent: circuit.voltageDropPercent,
      status: rowStatus(circuit.id, electrical.issues),
    });
    nextWay += moduleWidth;
  }

  const requiredWays = Math.max(0, nextWay - 1);
  const usedWays = Math.min(requiredWays, totalWays);
  const fillPercent =
    totalWays > 0 ? Math.round((requiredWays / totalWays) * 1000) / 10 : 0;
  const issues: PanelIssue[] = [];

  if (requiredWays > totalWays) {
    issues.push({
      code: 'panelOverflow',
      severity: 'error',
      params: { used: requiredWays, total: totalWays },
    });
  } else if (fillPercent >= 80) {
    issues.push({
      code: 'panelNearlyFull',
      severity: 'warning',
      params: { percent: fillPercent },
    });
  }

  const recommended = electrical.recommendedMainBreakerA;
  if (recommended !== null && board.mainBreaker.ratingA < recommended) {
    issues.push({
      code: 'mainBreakerUndersized',
      severity: 'warning',
      params: {
        rating: board.mainBreaker.ratingA,
        recommended,
      },
    });
  }

  return {
    board,
    rows,
    totalWays,
    usedWays,
    reserveWays: Math.max(0, totalWays - requiredWays),
    fillPercent,
    issues,
  };
}
