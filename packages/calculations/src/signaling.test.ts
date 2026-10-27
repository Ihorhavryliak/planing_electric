import { describe, expect, it } from 'vitest';
import { buildSignalingTakeoff } from './signaling';

const loop = {
  id: 'F1',
  code: 'F1',
  name: 'Fire loop',
  type: 'fire' as const,
  voltageV: 24,
  maxDevices: 2,
  maxLength: 100,
};

const room = {
  id: 'r1',
  name: 'Hall',
  boundary: [
    { x: 0, y: 0 },
    { x: 800, y: 0 },
    { x: 800, y: 800 },
    { x: 0, y: 1000 },
  ],
};

describe('signaling takeoff', () => {
  it('aggregates devices, addresses, cable, current and voltage drop', () => {
    const result = buildSignalingTakeoff({
      loops: [loop],
      points: [
        {
          id: 'p1',
          subtype: 'smoke-detector',
          loopId: 'F1',
          address: 1,
          x: 100,
          y: 100,
          standbyA: 0.0004,
          alarmA: 0.003,
          coverageAreaM2: 85,
        },
        {
          id: 'p2',
          subtype: 'siren-internal',
          loopId: 'F1',
          address: 2,
          x: 500,
          y: 500,
          standbyA: 0,
          alarmA: 0.025,
        },
      ],
      routes: [
        {
          id: 'r1',
          system: 'fire',
          loopId: 'F1',
          geometry: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
          requiredLength: 80,
        },
      ],
      rooms: [room],
      metersPerUnit: 0.01,
    });

    expect(result.loops[0]).toMatchObject({
      deviceCount: 2,
      cableMeters: 80,
      addresses: [1, 2],
      status: 'ok',
    });
    expect(result.loops[0]?.standbyA).toBeCloseTo(0.0004);
    expect(result.loops[0]?.alarmA).toBeCloseTo(0.028);
    expect(result.battery.requiredAh).toBeGreaterThan(0);
    expect(result.fire.detectors).toBe(1);
    expect(result.fire.uncoveredRooms).toEqual([]);
  });

  it('flags duplicate addresses and loop limits', () => {
    const result = buildSignalingTakeoff({
      loops: [{ ...loop, maxDevices: 1 }],
      points: [
        { id: 'p1', subtype: 'smoke-detector', loopId: 'F1', address: 4 },
        { id: 'p2', subtype: 'heat-detector', loopId: 'F1', address: 4 },
      ],
      routes: [],
      metersPerUnit: 0.01,
    });

    expect(result.loops[0]?.duplicateAddresses).toEqual([4]);
    expect(result.loops[0]?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['loopDeviceOverflow', 'duplicateAddress']),
    );
    expect(result.loops[0]?.status).toBe('error');
  });

  it('warns about missing fire/siren coverage and CCTV blind spots', () => {
    const result = buildSignalingTakeoff({
      loops: [loop],
      points: [],
      routes: [],
      rooms: [room],
      metersPerUnit: 0.01,
    });

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'smokeCoverageMissing',
        'sirenCoverageMissing',
        'cameraBlindSpot',
      ]),
    );
    expect(result.fire.uncoveredRooms).toEqual(['Hall']);
  });

  it('calculates SCS ports and archive load', () => {
    const result = buildSignalingTakeoff({
      loops: [],
      points: [
        { id: 'd1', subtype: 'data-lan' },
        { id: 'd2', subtype: 'data-camera' },
        { id: 'pp', subtype: 'patch-panel' },
        { id: 'sw', subtype: 'network-switch' },
        { id: 'cam', subtype: 'ip-camera', x: 500, y: 500 },
      ],
      routes: [
        {
          id: 'd1',
          system: 'data',
          geometry: [
            { x: 0, y: 0 },
            { x: 2000, y: 0 },
          ],
          requiredLength: 90,
        },
      ],
      rooms: [room],
      metersPerUnit: 0.01,
    });

    expect(result.scs).toMatchObject({
      ports: 2,
      patchPanels: 1,
      switches: 1,
      longestRunMeters: 90,
    });
    expect(result.cctv.archiveGbPerDay).toBe(42);
  });
});
