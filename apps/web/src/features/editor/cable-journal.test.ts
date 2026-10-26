import { describe, expect, it } from 'vitest';
import { calculateElectrical } from '@drawmyplace/calculations';
import { buildCircuitNumbering } from './circuit-numbering';
import { buildCableJournal, buildCableJournalCsv } from './cable-journal';

const circuits = [{ id: 'L1', name: 'Lighting', color: '#f59e0b' }];
const points = [
  {
    id: 'p1',
    floorId: 'f1',
    type: 'light' as const,
    x: 0,
    y: 0,
    rotation: 0,
    label: null,
    mountingHeight: null,
    properties: { circuitId: 'L1' },
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
const routes = [
  {
    id: 'r1',
    floorId: 'f1',
    circuitId: 'L1',
    materialId: null,
    geometry: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    settings: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('cable journal', () => {
  it('joins circuit numbering, electrical settings and cable lengths', () => {
    const electrical = calculateElectrical({
      circuits,
      devices: [{ id: 'p1', circuitId: 'L1', type: 'light' }],
      lengthsByCircuit: { L1: 12.5 },
    });
    const numbering = buildCircuitNumbering(circuits, electrical);
    const rows = buildCableJournal({
      circuits,
      points,
      routes,
      cableLengths: { L1: 12.5 },
      electrical,
      numbering,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      address: 'Q1-1L1',
      wire: 'W1',
      terminal: 'X1:1',
      breaker: '16 A C · 1P',
      cable: '2.5 mm² copper',
      length: 12.5,
      devices: 1,
      routes: 1,
    });
  });

  it('writes a UTF-8 CSV with an escaped header row', () => {
    const csv = buildCableJournalCsv(
      [
        {
          address: 'Q1-1L1',
          wire: 'W1',
          terminal: 'X1:1',
          circuit: 'L1',
          name: 'Lighting; hall',
          phase: 'L1',
          breaker: '16 A C · 1P',
          rcd: '25 A / 30 mA',
          cable: '2.5 mm² copper',
          length: 12.5,
          devices: 1,
          routes: 1,
        },
      ],
      [
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
      ],
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Lighting; hall"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
