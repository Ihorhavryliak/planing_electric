import type { Circuit, PublicPoint, PublicRoute } from '@drawmyplace/contracts';
import type { ElectricalPlanResult } from '@drawmyplace/calculations';
import type { CircuitNumbering } from './circuit-numbering';

export interface CableJournalInput {
  circuits: readonly Circuit[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  cableLengths: Readonly<Record<string, number>>;
  electrical?: ElectricalPlanResult | null;
  numbering: CircuitNumbering;
}

export interface CableJournalRow {
  address: string;
  wire: string;
  terminal: string;
  circuit: string;
  name: string;
  phase: string;
  breaker: string;
  rcd: string;
  cable: string;
  length: number;
  devices: number;
  routes: number;
}

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCableJournal(input: CableJournalInput): CableJournalRow[] {
  const electricalByCircuit = new Map(
    (input.electrical?.circuits ?? []).map((circuit) => [circuit.id, circuit]),
  );

  return input.circuits.map((circuit) => {
    const number = input.numbering.circuits[circuit.id];
    const electrical = electricalByCircuit.get(circuit.id);
    const points = input.points.filter(
      (point) => point.properties.circuitId === circuit.id,
    );
    const routes = input.routes.filter(
      (route) => route.circuitId === circuit.id,
    );

    return {
      address: number?.address ?? circuit.id,
      wire: number?.wireTag ?? '—',
      terminal: number?.terminalTag ?? '—',
      circuit: circuit.id,
      name: circuit.name,
      phase: electrical?.phase ?? number?.phase ?? 'L1',
      breaker: electrical
        ? `${electrical.breaker.ratingA} A ${electrical.breaker.curve} · ${electrical.breaker.poles}P`
        : '—',
      rcd: electrical?.rcd
        ? `${electrical.rcd.ratingA} A / ${electrical.rcd.sensitivityMa} mA`
        : '—',
      cable: electrical?.cable
        ? `${electrical.cable.sectionMm2} mm² ${electrical.cable.material}`
        : '—',
      length: Math.round((input.cableLengths[circuit.id] ?? 0) * 100) / 100,
      devices: points.length,
      routes: routes.length,
    };
  });
}

export function buildCableJournalCsv(
  rows: readonly CableJournalRow[],
  labels: readonly string[],
): string {
  const header =
    labels.length === 10
      ? labels
      : [
          'Address',
          'Wire',
          'Terminal',
          'Circuit',
          'Name',
          'Phase',
          'Breaker',
          'RCD',
          'Cable',
          'Length, m',
        ];
  const body = rows.map((row) => [
    row.address,
    row.wire,
    row.terminal,
    row.circuit,
    row.name,
    row.phase,
    row.breaker,
    row.rcd,
    row.cable,
    row.length,
  ]);

  return `\uFEFF${[header, ...body]
    .map((cells) => cells.map(cell).join(';'))
    .join('\r\n')}`;
}
