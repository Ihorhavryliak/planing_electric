import { describe, expect, it } from 'vitest';
import { calculateElectrical } from '@drawmyplace/calculations';
import { buildCircuitNumbering } from './circuit-numbering';

describe('circuit numbering', () => {
  it('numbers boards, breakers, wires and terminals deterministically', () => {
    const circuits = [
      { id: 'L1', name: 'Lighting', color: '#f59e0b' },
      { id: 'G1', name: 'Sockets', color: '#38bdf8' },
    ];
    const electrical = calculateElectrical({
      circuits,
      settings: { supply: 'three-phase' },
      lengthsByCircuit: { L1: 10, G1: 20 },
      devices: [
        { id: 'p1', circuitId: 'L1', type: 'light' },
        { id: 'p2', circuitId: 'G1', type: 'socket' },
      ],
    });
    const numbering = buildCircuitNumbering(circuits, electrical);

    expect(numbering.boardTag).toBe('Q1');
    expect(numbering.circuits.L1).toMatchObject({
      address: 'Q1-1L1',
      breakerTag: 'QF1',
      wireTag: 'W1',
      terminalTag: 'X1:1',
      phase: 'L1',
    });
    expect(numbering.circuits.G1).toMatchObject({
      address: 'Q1-2L2',
      breakerTag: 'QF2',
      wireTag: 'W2',
      terminalTag: 'X1:2',
      phase: 'L2',
    });
  });

  it('falls back to L1 when no electrical result is supplied', () => {
    const numbering = buildCircuitNumbering([
      { id: 'A', name: 'A', color: '#ffffff' },
    ]);
    expect(numbering.circuits.A?.address).toBe('Q1-1L1');
  });
});
