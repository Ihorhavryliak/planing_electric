import { describe, expect, it } from 'vitest';
import {
  calculateElectrical,
  cableAmpacity,
  designCurrent,
  deviceDemandFactor,
  devicePowerW,
  faultCurrentA,
  normalizeElectricalSettings,
  voltageDropVolts,
} from './index';

describe('electrical load calculation', () => {
  it('uses catalog power and demand factors per subtype', () => {
    expect(devicePowerW({ id: 'a', circuitId: 'L1', subtype: 'socket-double' })).toBe(600);
    expect(deviceDemandFactor({ id: 'a', circuitId: 'L1', subtype: 'socket-double' })).toBe(0.5);
    expect(devicePowerW({ id: 'b', circuitId: 'L1', type: 'light' })).toBe(100);
    expect(deviceDemandFactor({ id: 'b', circuitId: 'L1', type: 'light' })).toBe(1);
  });

  it('computes connected and demand power for a circuit', () => {
    const result = calculateElectrical({
      circuits: [{ id: 'L1', name: 'Sockets' }],
      devices: [
        { id: 'p1', circuitId: 'L1', type: 'socket', subtype: 'socket-double' },
        { id: 'p2', circuitId: 'L1', type: 'socket', subtype: 'socket-double' },
        { id: 'p3', circuitId: 'L1', type: 'light', subtype: 'light-ceiling' },
      ],
      lengthsByCircuit: { L1: 10 },
    });

    expect(result.totalConnectedPowerW).toBe(1_300);
    expect(result.totalDemandPowerW).toBe(700);
    expect(result.circuits[0]?.currentA).toBeCloseTo(700 / (230 * 0.92), 2);
  });

  it('computes single- and three-phase design current', () => {
    expect(designCurrent(2_300, 1, 1)).toBeCloseTo(10, 10);
    expect(designCurrent(11_000, 0.9, 3)).toBeCloseTo(11_000 / (3 * 230 * 0.9), 10);
  });

  it('computes voltage drop for single- and three-phase runs', () => {
    const single = voltageDropVolts({
      currentA: 16,
      lengthMeters: 20,
      cosPhi: 1,
      material: 'copper',
      sectionMm2: 2.5,
      phases: 1,
    });
    const three = voltageDropVolts({
      currentA: 16,
      lengthMeters: 20,
      cosPhi: 1,
      material: 'copper',
      sectionMm2: 2.5,
      phases: 3,
    });

    expect(single).toBeCloseTo(5.76, 3);
    expect(three).toBeCloseTo(4.988, 2);
  });

  it('estimates the single-phase fault current at the end of the run', () => {
    const current = faultCurrentA({
      sourceFaultCurrentKa: 6,
      lengthMeters: 20,
      material: 'copper',
      sectionMm2: 2.5,
      voltageV: 230,
    });

    expect(current).toBeCloseTo(577.4, 0);
  });

  it('knows ampacity for copper and aluminium', () => {
    expect(cableAmpacity('copper', 2.5)).toBe(24);
    expect(cableAmpacity('aluminium', 2.5)).toBeCloseTo(18.72, 2);
    expect(cableAmpacity('copper', 3)).toBe(0);
  });
});

describe('electrical coordination checks', () => {
  const base = {
    circuits: [{ id: 'L1', name: 'Sockets' }],
    lengthsByCircuit: { L1: 20 },
  } as const;

  it('returns a clean result for a well-sized circuit', () => {
    const result = calculateElectrical({
      ...base,
      devices: [{ id: 'p1', circuitId: 'L1', type: 'socket', subtype: 'socket-double' }],
    });

    expect(result.issues).toHaveLength(0);
    expect(result.circuits[0]?.voltageDropPercent).toBeLessThan(3);
    expect(result.circuits[0]?.faultTripOk).toBe(true);
  });

  it('flags a load above the breaker rating', () => {
    const result = calculateElectrical({
      ...base,
      devices: [
        {
          id: 'p1',
          circuitId: 'L1',
          type: 'socket',
          subtype: 'socket-dedicated',
          powerW: 4_000,
          demandFactor: 1,
          },
      ],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'currentExceedsBreaker', severity: 'error' }),
      ]),
    );
  });

  it('flags a breaker larger than the cable ampacity', () => {
    const result = calculateElectrical({
      ...base,
      settings: {
        defaultBreaker: { ratingA: 25 },
        defaultCable: { sectionMm2: 1.5 },
      },
      devices: [
        {
          id: 'p1',
          circuitId: 'L1',
          type: 'light',
          subtype: 'light-ceiling',
          powerW: 2_000,
          demandFactor: 1,
        },
      ],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'breakerExceedsCable', severity: 'error' }),
      ]),
    );
  });

  it('warns when voltage drop exceeds the power limit', () => {
    const result = calculateElectrical({
      circuits: [{ id: 'L1', name: 'Long run' }],
      lengthsByCircuit: { L1: 120 },
      devices: [
        {
          id: 'p1',
          circuitId: 'L1',
          type: 'socket',
          subtype: 'socket-double',
          powerW: 2_300,
          demandFactor: 1,
        },
      ],
    });

    expect(result.circuits[0]?.voltageDropPercent).toBeGreaterThan(5);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'voltageDropExceeded', severity: 'warning' }),
      ]),
    );
  });

  it('warns when a socket circuit has no RCD', () => {
    const result = calculateElectrical({
      ...base,
      settings: { defaultRcd: null },
      devices: [{ id: 'p1', circuitId: 'L1', type: 'socket', subtype: 'socket-double' }],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'rcdMissing', severity: 'warning' }),
      ]),
    );
  });

  it('warns when the fault current cannot trip the magnetic release', () => {
    const result = calculateElectrical({
      circuits: [{ id: 'L1', name: 'Long run' }],
      lengthsByCircuit: { L1: 300 },
      settings: { sourceFaultCurrentKa: 1 },
      devices: [
        {
          id: 'p1',
          circuitId: 'L1',
          type: 'socket',
          subtype: 'socket-double',
          powerW: 1_000,
          demandFactor: 1,
        },
      ],
    });

    expect(result.circuits[0]?.faultTripOk).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'faultCurrentLow', severity: 'warning' }),
      ]),
    );
  });

  it('splits single-phase circuits across phases and recommends an intake breaker', () => {
    const result = calculateElectrical({
      circuits: [
        { id: 'L1', name: 'One' },
        { id: 'L2', name: 'Two' },
        { id: 'L3', name: 'Three' },
      ],
      settings: { supply: 'three-phase' },
      lengthsByCircuit: { L1: 10, L2: 10, L3: 10 },
      devices: [
        { id: 'a', circuitId: 'L1', type: 'socket', subtype: 'socket-double' },
        { id: 'b', circuitId: 'L2', type: 'socket', subtype: 'socket-double' },
        { id: 'c', circuitId: 'L3', type: 'socket', subtype: 'socket-double' },
      ],
    });

    expect(result.circuits.map((circuit) => circuit.phase)).toEqual([
      'L1',
      'L2',
      'L3',
    ]);
    expect(result.maxPhaseCurrentA).toBeGreaterThan(0);
    expect(result.recommendedMainBreakerA).not.toBeNull();
  });

  it('adds a three-phase load current to every phase', () => {
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
    const circuit = result.circuits[0];

    expect(circuit?.phases).toBe(3);
    expect(circuit?.currentA).toBeCloseTo(11_000 / (3 * 230 * 0.92), 2);
    expect(result.phaseCurrents.L1).toBe(circuit?.currentA);
    expect(result.phaseCurrents.L2).toBe(circuit?.currentA);
    expect(result.phaseCurrents.L3).toBe(circuit?.currentA);
  });

  it('skips length-based checks while the plan is uncalibrated', () => {
    const result = calculateElectrical({
      ...base,
      calibrated: false,
      lengthsByCircuit: null,
      devices: [
        {
          id: 'p1',
          circuitId: 'L1',
          type: 'socket',
          subtype: 'socket-double',
          powerW: 2_300,
          demandFactor: 1,
        },
      ],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'electricalUncalibrated' }),
      ]),
    );
    expect(result.circuits[0]?.voltageDropOk).toBe(true);
    expect(result.circuits[0]?.faultCurrentA).toBe(0);
  });

  it('normalizes partial settings without losing nested defaults', () => {
    const settings = normalizeElectricalSettings({
      defaultCable: { sectionMm2: 4 },
      defaultRcd: null,
    });

    expect(settings.defaultCable.sectionMm2).toBe(4);
    expect(settings.defaultCable.material).toBe('copper');
    expect(settings.defaultRcd).toBeNull();
    expect(settings.circuits).toEqual({});
  });
});
