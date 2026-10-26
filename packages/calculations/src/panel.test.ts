import { describe, expect, it } from 'vitest';
import { buildPanelSchedule, calculateElectrical } from './index';

function calculations(
  settings: Parameters<typeof calculateElectrical>[0]['settings'] = {},
) {
  return calculateElectrical({
    circuits: [
      { id: 'L1', name: 'Lighting' },
      { id: 'L2', name: 'Sockets' },
    ],
    devices: [
      { id: 'p1', circuitId: 'L1', type: 'light', subtype: 'light-ceiling' },
      { id: 'p2', circuitId: 'L2', type: 'socket', subtype: 'socket-double' },
    ],
    lengthsByCircuit: { L1: 10, L2: 20 },
    settings,
  });
}

describe('panel schedule', () => {
  it('lays out circuits by modular width and calculates fill', () => {
    const schedule = buildPanelSchedule(calculations());

    expect(schedule.totalWays).toBe(36);
    expect(schedule.rows.map((row) => row.way)).toEqual([1, 3]);
    expect(schedule.rows.map((row) => row.moduleWidth)).toEqual([2, 2]);
    expect(schedule.usedWays).toBe(4);
    expect(schedule.reserveWays).toBe(32);
    expect(schedule.fillPercent).toBeCloseTo(11.1, 1);
    expect(schedule.issues).toEqual([]);
  });

  it('uses the widest protection device for a three-phase circuit', () => {
    const result = calculateElectrical({
      circuits: [{ id: 'P1', name: 'Three-phase socket' }],
      settings: { supply: 'three-phase' },
      lengthsByCircuit: { P1: 20 },
      devices: [
        {
          id: 'p1',
          circuitId: 'P1',
          type: 'socket',
          subtype: 'socket-three-phase',
          powerW: 11_000,
          demandFactor: 1,
        },
      ],
    });
    const schedule = buildPanelSchedule(result);

    expect(schedule.rows[0]?.breaker.poles).toBe(3);
    expect(schedule.rows[0]?.rcd?.poles).toBe(4);
    expect(schedule.rows[0]?.moduleWidth).toBe(4);
  });

  it('reports a full board as an error', () => {
    const schedule = buildPanelSchedule(
      calculations({ board: { rows: 1, waysPerRow: 2 } }),
    );

    expect(schedule.usedWays).toBe(2);
    expect(schedule.reserveWays).toBe(0);
    expect(schedule.fillPercent).toBe(200);
    expect(schedule.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'panelOverflow', severity: 'error' }),
      ]),
    );
  });

  it('warns when less than 20% reserve remains', () => {
    const schedule = buildPanelSchedule(
      calculateElectrical({
        circuits: [{ id: 'L1', name: 'Lighting' }],
        devices: [
          { id: 'p1', circuitId: 'L1', type: 'light', subtype: 'light-ceiling' },
        ],
        lengthsByCircuit: { L1: 10 },
        settings: { board: { rows: 1, waysPerRow: 2 } },
      }),
    );

    expect(schedule.fillPercent).toBe(100);
    expect(schedule.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'panelNearlyFull', severity: 'warning' }),
      ]),
    );
  });

  it('warns when the incoming breaker is below the recommended rating', () => {
    const result = calculateElectrical({
      circuits: [{ id: 'P1', name: 'Load' }],
      devices: [
        {
          id: 'p1',
          circuitId: 'P1',
          type: 'socket',
          subtype: 'socket-double',
          powerW: 5_000,
          demandFactor: 1,
        },
      ],
      lengthsByCircuit: { P1: 10 },
      settings: {
        defaultBreaker: { ratingA: 32 },
        defaultCable: { sectionMm2: 6 },
        board: { mainBreaker: { ratingA: 16 } },
      },
    });
    const schedule = buildPanelSchedule(result);

    expect(schedule.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'mainBreakerUndersized',
          severity: 'warning',
        }),
      ]),
    );
  });
});
