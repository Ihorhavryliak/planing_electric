/**
 * Engineering calculations for electrical installations: connected/demand
 * load, design current, voltage drop, single-phase fault current and the
 * coordination of breaker, RCD and cable.
 *
 * The module is intentionally free of framework and contract dependencies so
 * it can run in the browser, in the API and in unit tests.
 */

export type ConductorMaterial = 'copper' | 'aluminium';
export type SupplyType = 'single-phase' | 'three-phase';
export type LoadKind = 'lighting' | 'power' | 'mixed';
export type BreakerCurve = 'B' | 'C' | 'D';
export type Phase = 'L1' | 'L2' | 'L3';
export type BreakerPoles = 1 | 2 | 3 | 4;
export type RcdPoles = 2 | 4;

export interface CableSettings {
  material: ConductorMaterial;
  /** Nominal cross-section of one conductor, mm². */
  sectionMm2: number;
  /** Total route length to the farthest load, meters. */
  lengthMeters: number | null;
}

export interface BreakerSettings {
  ratingA: number;
  curve: BreakerCurve;
  breakingCapacityKa: number;
  /** Modular width / number of protected poles. */
  poles: BreakerPoles;
}

export interface RcdSettings {
  ratingA: number;
  sensitivityMa: number;
  poles: RcdPoles;
}

export interface CircuitElectricalSettings {
  loadKind?: LoadKind;
  cosPhi?: number;
  phase?: Phase;
  /** 1 for single-phase loads, 3 for three-phase loads. */
  phases?: 1 | 3;
  cable?: Partial<CableSettings>;
  breaker?: Partial<BreakerSettings>;
  rcd?: Partial<RcdSettings> | null;
}

export interface PanelBoardSettings {
  name: string;
  location: string | null;
  /** Number of DIN rows. */
  rows: number;
  /** Modular ways per row. */
  waysPerRow: number;
  mainBreaker: BreakerSettings;
  rcd: RcdSettings | null;
}

export interface PanelBoardInput {
  name?: string;
  location?: string | null;
  rows?: number;
  waysPerRow?: number;
  mainBreaker?: Partial<BreakerSettings>;
  rcd?: Partial<RcdSettings> | null;
}

export interface ElectricalSettings {
  supply: SupplyType;
  /** Phase voltage, V (230 by default). */
  voltageV: number;
  defaultCosPhi: number;
  defaultCable: CableSettings;
  defaultBreaker: BreakerSettings;
  defaultRcd: RcdSettings | null;
  /** Prospective short-circuit current at the origin, kA. */
  sourceFaultCurrentKa: number;
  maxVoltageDropLightingPercent: number;
  maxVoltageDropPowerPercent: number;
  circuits: Record<string, CircuitElectricalSettings>;
  board: PanelBoardSettings;
}

export type ElectricalSettingsInput = {
  supply?: SupplyType;
  voltageV?: number;
  defaultCosPhi?: number;
  defaultCable?: Partial<CableSettings> & { lengthMeters?: number | null };
  defaultBreaker?: Partial<BreakerSettings>;
  defaultRcd?: Partial<RcdSettings> | null;
  sourceFaultCurrentKa?: number;
  maxVoltageDropLightingPercent?: number;
  maxVoltageDropPowerPercent?: number;
  circuits?: Record<string, CircuitElectricalSettings>;
  board?: PanelBoardInput;
};

export interface ElectricalDevice {
  id: string;
  circuitId: string | null;
  /** Catalog subtype, e.g. `socket-double` or `light-ceiling`. */
  subtype?: string | null;
  /** Base point type, used when the subtype is unknown. */
  type?: string | null;
  /** Explicit rated power, W. Overrides the catalog default. */
  powerW?: number | null;
  /** Explicit demand factor, 0…1. Overrides the catalog default. */
  demandFactor?: number | null;
}

export interface ElectricalCircuitInput {
  id: string;
  name?: string;
}

export type ElectricalIssueCode =
  | 'electricalUncalibrated'
  | 'circuitNoDevices'
  | 'circuitNoRoute'
  | 'orphanDevice'
  | 'currentExceedsBreaker'
  | 'breakerExceedsCable'
  | 'unknownCableSection'
  | 'voltageDropExceeded'
  | 'faultCurrentLow'
  | 'breakingCapacityExceeded'
  | 'rcdMissing'
  | 'rcdSensitivityHigh'
  | 'rcdRatingLow';

export type ElectricalSeverity = 'error' | 'warning' | 'info';

export interface ElectricalIssue {
  code: ElectricalIssueCode;
  severity: ElectricalSeverity;
  circuitId: string | null;
  params?: Record<string, string | number>;
}

export interface ElectricalCircuitResult {
  id: string;
  name: string;
  loadKind: LoadKind;
  phase: Phase;
  phases: 1 | 3;
  deviceCount: number;
  connectedPowerW: number;
  demandFactor: number;
  demandPowerW: number;
  cosPhi: number;
  currentA: number;
  cable: CableSettings & { ampacityA: number };
  breaker: BreakerSettings;
  rcd: RcdSettings | null;
  voltageDropVolts: number;
  voltageDropPercent: number;
  voltageDropLimitPercent: number;
  voltageDropOk: boolean;
  faultCurrentA: number;
  magneticTripA: number;
  faultTripOk: boolean;
  breakingCapacityOk: boolean;
}

export interface ElectricalPlanResult {
  settings: ElectricalSettings;
  calibrated: boolean;
  circuits: ElectricalCircuitResult[];
  totalConnectedPowerW: number;
  totalDemandPowerW: number;
  demandFactor: number;
  /** Currents including a per-phase split for balanced three-phase supplies. */
  phaseCurrents: Record<Phase, number>;
  maxPhaseCurrentA: number;
  equivalentCurrentA: number;
  recommendedMainBreakerA: number | null;
  worstVoltageDropPercent: number;
  issues: ElectricalIssue[];
}

export const DEFAULT_ELECTRICAL_SETTINGS: ElectricalSettings = {
  supply: 'single-phase',
  voltageV: 230,
  defaultCosPhi: 0.92,
  defaultCable: {
    material: 'copper',
    sectionMm2: 2.5,
    lengthMeters: null,
  },
  defaultBreaker: {
    ratingA: 16,
    curve: 'C',
    breakingCapacityKa: 6,
    poles: 1,
  },
  defaultRcd: {
    ratingA: 25,
    sensitivityMa: 30,
    poles: 2,
  },
  sourceFaultCurrentKa: 6,
  maxVoltageDropLightingPercent: 3,
  maxVoltageDropPowerPercent: 5,
  circuits: {},
  board: {
    name: 'Main board',
    location: null,
    rows: 3,
    waysPerRow: 12,
    mainBreaker: {
      ratingA: 40,
      curve: 'C',
      breakingCapacityKa: 6,
      poles: 2,
    },
    rcd: null,
  },
};

/** Copper PVC-insulated conductors in a wall, IEC 60364-5-52 (B1). */
export const CABLE_AMPACITY_COPPER: Readonly<Record<number, number>> = {
  1.5: 17.5,
  2.5: 24,
  4: 32,
  6: 41,
  10: 57,
  16: 76,
  25: 101,
  35: 125,
  50: 151,
  70: 192,
  95: 232,
  120: 269,
  150: 300,
  185: 341,
  240: 400,
};

export const CABLE_SECTIONS_MM2: readonly number[] = Object.keys(
  CABLE_AMPACITY_COPPER,
)
  .map(Number)
  .sort((a, b) => a - b);

export const BREAKER_RATINGS_A: readonly number[] = [
  6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250,
];

/** Demand factors by subtype; the rest default to 1. */
export const DEVICE_DEMAND_FACTORS: Readonly<Record<string, number>> = {
  'socket-single': 0.5,
  'socket-double': 0.5,
  'socket-triple': 0.5,
  'socket-kitchen': 0.7,
  'socket-dedicated': 0.8,
  'socket-three-phase': 0.9,
  'socket-floor': 0.5,
  'socket-outdoor': 0.6,
  'light-ceiling': 1,
  'light-wall': 1,
  'light-pendant': 1,
  'light-led-strip': 1,
  'light-emergency': 1,
  'light-outdoor': 1,
  'data-lan': 0.3,
  'data-tv': 0.3,
  'data-satellite': 0.3,
  'data-intercom': 0.3,
  'data-alarm': 0.3,
  'data-camera': 0.3,
  'data-speaker': 0.3,
  'data-smart-home': 0.3,
  'motion-sensor': 0.1,
  'thermostat': 0.1,
  'blind-controller': 0.1,
  'smart-switch': 0.1,
};

/** Typical connected power per catalog subtype, W. */
export const DEVICE_POWER_W: Readonly<Record<string, number>> = {
  'socket-single': 300,
  'socket-double': 600,
  'socket-triple': 900,
  'socket-kitchen': 2_000,
  'socket-dedicated': 2_500,
  'socket-three-phase': 11_000,
  'socket-floor': 300,
  'socket-outdoor': 1_000,
  'switch-single': 0,
  'switch-double': 0,
  'switch-two-way': 0,
  'switch-intermediate': 0,
  dimmer: 0,
  'motion-sensor': 5,
  'blind-controller': 10,
  thermostat: 5,
  'smart-switch': 3,
  'light-ceiling': 100,
  'light-wall': 60,
  'light-pendant': 100,
  'light-led-strip': 120,
  'light-emergency': 20,
  'light-outdoor': 100,
  'data-lan': 10,
  'data-tv': 10,
  'data-satellite': 10,
  'data-intercom': 10,
  'data-alarm': 10,
  'data-camera': 10,
  'data-speaker': 10,
  'data-smart-home': 10,
};

const TYPE_POWER_W: Readonly<Record<string, number>> = {
  socket: 300,
  light: 100,
  switch: 0,
  panel: 0,
  junction: 0,
  custom: 10,
};

const TYPE_DEMAND_FACTOR: Readonly<Record<string, number>> = {
  socket: 0.5,
  light: 1,
  switch: 0.1,
  panel: 0,
  junction: 0,
  custom: 0.3,
};

const LIGHTING_SUBTYPES = new Set(
  Object.keys(DEVICE_POWER_W).filter((id) => id.startsWith('light-')),
);

/** Resistivity at conductor operating temperature, Ω·mm²/m. */
const RESISTIVITY: Readonly<Record<ConductorMaterial, number>> = {
  copper: 0.0225,
  aluminium: 0.036,
};

/** Linear reactance of a low-voltage cable, Ω/m. */
const REACTANCE_PER_METER = 0.00008;
const THREE_PHASE_FACTOR = Math.sqrt(3);
const STANDARD_RCD_SENSITIVITY_MA = 30;
/** Multiples of In for the instantaneous magnetic trip. */
const MAGNETIC_TRIP: Readonly<Record<BreakerCurve, number>> = {
  B: 5,
  C: 10,
  D: 20,
};

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function clampFactor(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0.01, value));
}

function breakerPoles(
  value: number | undefined,
  fallback: BreakerPoles,
): BreakerPoles {
  return value === 1 || value === 2 || value === 3 || value === 4
    ? value
    : fallback;
}

function rcdPoles(value: number | undefined, fallback: RcdPoles): RcdPoles {
  return value === 2 || value === 4 ? value : fallback;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function mergeSettings(input?: ElectricalSettingsInput | null): ElectricalSettings {
  const supply = input?.supply ?? DEFAULT_ELECTRICAL_SETTINGS.supply;
  const base = DEFAULT_ELECTRICAL_SETTINGS;

  return {
    supply,
    voltageV: positive(input?.voltageV, base.voltageV),
    defaultCosPhi: clampFactor(input?.defaultCosPhi, base.defaultCosPhi),
    defaultCable: {
      material: input?.defaultCable?.material ?? base.defaultCable.material,
      sectionMm2: positive(
        input?.defaultCable?.sectionMm2,
        base.defaultCable.sectionMm2,
      ),
      lengthMeters: base.defaultCable.lengthMeters,
    },
    defaultBreaker: {
      ratingA: positive(input?.defaultBreaker?.ratingA, base.defaultBreaker.ratingA),
      curve: input?.defaultBreaker?.curve ?? base.defaultBreaker.curve,
      breakingCapacityKa: positive(
        input?.defaultBreaker?.breakingCapacityKa,
        base.defaultBreaker.breakingCapacityKa,
      ),
      poles: breakerPoles(
        input?.defaultBreaker?.poles,
        base.defaultBreaker.poles,
      ),
    },
    defaultRcd:
      input?.defaultRcd === null
        ? null
        : {
            ratingA: positive(
              input?.defaultRcd?.ratingA,
              base.defaultRcd?.ratingA ?? 25,
            ),
            sensitivityMa: positive(
              input?.defaultRcd?.sensitivityMa,
              base.defaultRcd?.sensitivityMa ?? 30,
            ),
            poles: rcdPoles(
              input?.defaultRcd?.poles,
              base.defaultRcd?.poles ?? 2,
            ),
          },
    sourceFaultCurrentKa: positive(
      input?.sourceFaultCurrentKa,
      base.sourceFaultCurrentKa,
    ),
    maxVoltageDropLightingPercent: positive(
      input?.maxVoltageDropLightingPercent,
      base.maxVoltageDropLightingPercent,
    ),
    maxVoltageDropPowerPercent: positive(
      input?.maxVoltageDropPowerPercent,
      base.maxVoltageDropPowerPercent,
    ),
    circuits: input?.circuits ?? {},
    board: {
      name: input?.board?.name?.trim() || base.board.name,
      location: input?.board?.location?.trim() || null,
      rows: clampInteger(input?.board?.rows, base.board.rows, 1, 20),
      waysPerRow: clampInteger(
        input?.board?.waysPerRow,
        base.board.waysPerRow,
        1,
        24,
      ),
      mainBreaker: {
        ratingA: positive(
          input?.board?.mainBreaker?.ratingA,
          base.board.mainBreaker.ratingA,
        ),
        curve: input?.board?.mainBreaker?.curve ?? base.board.mainBreaker.curve,
        breakingCapacityKa: positive(
          input?.board?.mainBreaker?.breakingCapacityKa,
          base.board.mainBreaker.breakingCapacityKa,
        ),
        poles: breakerPoles(
          input?.board?.mainBreaker?.poles,
          supply === 'three-phase' ? 4 : 2,
        ),
      },
      rcd:
        input?.board?.rcd === null
          ? null
          : input?.board?.rcd
            ? {
                ratingA: positive(input.board.rcd.ratingA, 25),
                sensitivityMa: positive(input.board.rcd.sensitivityMa, 30),
                poles: rcdPoles(input.board.rcd.poles, 2),
              }
            : base.board.rcd,
    },
  };
}

export function normalizeElectricalSettings(
  input?: ElectricalSettingsInput | null,
): ElectricalSettings {
  return mergeSettings(input);
}

export function devicePowerW(device: ElectricalDevice): number {
  if (device.powerW !== undefined && device.powerW !== null) {
    return Math.max(0, device.powerW);
  }

  if (device.subtype && device.subtype in DEVICE_POWER_W) {
    return DEVICE_POWER_W[device.subtype] ?? 0;
  }

  return TYPE_POWER_W[device.type ?? ''] ?? 0;
}

export function deviceDemandFactor(device: ElectricalDevice): number {
  if (device.demandFactor !== undefined && device.demandFactor !== null) {
    return clampFactor(device.demandFactor, 1);
  }

  if (device.subtype && device.subtype in DEVICE_DEMAND_FACTORS) {
    return DEVICE_DEMAND_FACTORS[device.subtype] ?? 1;
  }

  return TYPE_DEMAND_FACTOR[device.type ?? ''] ?? 1;
}

export function isLightingDevice(device: ElectricalDevice): boolean {
  return (
    device.type === 'light' ||
    (device.subtype !== null &&
      device.subtype !== undefined &&
      LIGHTING_SUBTYPES.has(device.subtype))
  );
}

export function cableAmpacity(
  material: ConductorMaterial,
  sectionMm2: number,
): number {
  const copper = CABLE_AMPACITY_COPPER[sectionMm2];

  if (copper === undefined) return 0;

  // Aluminium conductors carry roughly 78 % of the copper current.
  return material === 'aluminium' ? copper * 0.78 : copper;
}

export function nextStandardBreaker(currentA: number): number | null {
  return BREAKER_RATINGS_A.find((rating) => rating >= currentA) ?? null;
}

/** One-way design current of a load, A. */
export function designCurrent(
  powerW: number,
  cosPhi: number,
  phases: 1 | 3,
  voltageV = 230,
): number {
  if (powerW <= 0) return 0;

  const denominator =
    phases === 3
      ? THREE_PHASE_FACTOR * voltageV * THREE_PHASE_FACTOR * cosPhi
      : voltageV * cosPhi;
  // For a three-phase load the line voltage is √3 × phase voltage, so the
  // standard formula P / (√3 × U_line × cosφ) collapses to P / (3 × U_phase × cosφ).
  return powerW / denominator;
}

/** Voltage drop on a cable run, V. */
export function voltageDropVolts(input: {
  currentA: number;
  lengthMeters: number;
  cosPhi: number;
  material: ConductorMaterial;
  sectionMm2: number;
  phases: 1 | 3;
}): number {
  if (input.currentA <= 0 || input.lengthMeters <= 0) return 0;

  const resistance = (RESISTIVITY[input.material] * input.lengthMeters) /
    Math.max(input.sectionMm2, 0.01);
  const reactance = REACTANCE_PER_METER * input.lengthMeters;
  const sinPhi = Math.sqrt(Math.max(0, 1 - input.cosPhi * input.cosPhi));
  const path = input.phases === 3 ? THREE_PHASE_FACTOR : 2;

  return (
    path *
    input.currentA *
    (resistance * input.cosPhi + reactance * sinPhi)
  );
}

/**
 * Single-phase fault current at the end of the run (phase + protective
 * conductor), A. This is the minimum prospective current used for the
 * disconnection check.
 */
export function faultCurrentA(input: {
  sourceFaultCurrentKa: number;
  lengthMeters: number;
  material: ConductorMaterial;
  sectionMm2: number;
  voltageV?: number;
}): number {
  const voltage = positive(input.voltageV, 230);
  const sourceImpedance = voltage / (positive(input.sourceFaultCurrentKa, 6) * 1_000);
  const loopResistance =
    (2 * RESISTIVITY[input.material] * Math.max(0, input.lengthMeters)) /
    Math.max(input.sectionMm2, 0.01);
  const impedance = sourceImpedance + loopResistance;

  return impedance > 0 ? voltage / impedance : 0;
}

function circuitLoadKind(
  configured: LoadKind | undefined,
  devices: readonly ElectricalDevice[],
): LoadKind {
  if (configured) return configured;
  if (devices.length === 0) return 'mixed';

  const lighting = devices.filter(isLightingDevice).length;
  if (lighting === devices.length) return 'lighting';
  if (lighting === 0) return 'power';
  return 'mixed';
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function issue(
  code: ElectricalIssueCode,
  severity: ElectricalSeverity,
  circuitId: string | null,
  params?: Record<string, string | number>,
): ElectricalIssue {
  return { code, severity, circuitId, params };
}

/**
 * Runs the full low-voltage calculation for a plan: per-circuit load,
 * voltage drop, fault level and protective-device coordination, plus totals
 * for the intake.
 */
export function calculateElectrical(input: {
  circuits: readonly ElectricalCircuitInput[];
  devices: readonly ElectricalDevice[];
  settings?: ElectricalSettingsInput | null;
  /** Route length by circuit id, meters; null when the plan is uncalibrated. */
  lengthsByCircuit?: Readonly<Record<string, number | null>> | null;
  calibrated?: boolean;
}): ElectricalPlanResult {
  const settings = mergeSettings(input.settings);
  const calibrated = input.calibrated !== false;
  const issues: ElectricalIssue[] = [];

  if (!calibrated) {
    issues.push(issue('electricalUncalibrated', 'warning', null));
  }

  const devicesByCircuit = new Map<string, ElectricalDevice[]>();
  for (const circuit of input.circuits) devicesByCircuit.set(circuit.id, []);
  const orphanDevices: ElectricalDevice[] = [];

  for (const device of input.devices) {
    const id = device.circuitId?.trim();
    if (!id) continue;
    const bucket = devicesByCircuit.get(id);
    if (bucket) bucket.push(device);
    else orphanDevices.push(device);
  }

  const phaseCurrents: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  const results: ElectricalCircuitResult[] = [];

  input.circuits.forEach((circuit, index) => {
    const configured = settings.circuits[circuit.id] ?? {};
    const devices = devicesByCircuit.get(circuit.id) ?? [];
    const loadKind = circuitLoadKind(configured.loadKind, devices);
    const cosPhi = clampFactor(configured.cosPhi, settings.defaultCosPhi);
    const threePhaseDevice = devices.some(
      (device) => device.subtype === 'socket-three-phase',
    );
    const phases: 1 | 3 =
      configured.phases ??
      (settings.supply === 'three-phase' && threePhaseDevice ? 3 : 1);
    const phase: Phase =
      phased(settings, configured.phase, index) ?? 'L1';

    const connectedPowerW = devices.reduce(
      (total, device) => total + devicePowerW(device),
      0,
    );
    const weightedDemand = devices.reduce((total, device) => {
      return total + devicePowerW(device) * deviceDemandFactor(device);
    }, 0);
    const demandFactor =
      connectedPowerW > 0 ? weightedDemand / connectedPowerW : 1;
    const demandPowerW = Math.round(weightedDemand * 1000) / 1000;
    const currentA = designCurrent(
      demandPowerW,
      cosPhi,
      phases,
      settings.voltageV,
    );

    const cable: CableSettings = {
      material: configured.cable?.material ?? settings.defaultCable.material,
      sectionMm2: positive(
        configured.cable?.sectionMm2,
        settings.defaultCable.sectionMm2,
      ),
      lengthMeters:
        configured.cable?.lengthMeters ??
        input.lengthsByCircuit?.[circuit.id] ??
        null,
    };
    const lengthMeters = cable.lengthMeters ?? 0;
    const breaker: BreakerSettings = {
      ratingA: positive(
        configured.breaker?.ratingA,
        settings.defaultBreaker.ratingA,
      ),
      curve: configured.breaker?.curve ?? settings.defaultBreaker.curve,
      breakingCapacityKa: positive(
        configured.breaker?.breakingCapacityKa,
        settings.defaultBreaker.breakingCapacityKa,
      ),
      poles: breakerPoles(
        configured.breaker?.poles,
        phases === 3 ? 3 : settings.defaultBreaker.poles,
      ),
    };
    const rcd =
      configured.rcd === null
        ? null
        : configured.rcd
          ? {
              ratingA: positive(
                configured.rcd.ratingA,
                settings.defaultRcd?.ratingA ?? breaker.ratingA,
              ),
              sensitivityMa: positive(
                configured.rcd.sensitivityMa,
                settings.defaultRcd?.sensitivityMa ?? STANDARD_RCD_SENSITIVITY_MA,
              ),
              poles: rcdPoles(
                configured.rcd.poles,
                phases === 3 ? 4 : settings.defaultRcd?.poles ?? 2,
              ),
            }
          : settings.defaultRcd
            ? {
                ...settings.defaultRcd,
                poles: phases === 3 ? 4 : settings.defaultRcd.poles,
              }
            : null;

    const ampacityA = cableAmpacity(cable.material, cable.sectionMm2);
    const voltageDropLimitPercent =
      loadKind === 'lighting'
        ? settings.maxVoltageDropLightingPercent
        : settings.maxVoltageDropPowerPercent;
    const dropVolts = voltageDropVolts({
      currentA,
      lengthMeters,
      cosPhi,
      material: cable.material,
      sectionMm2: cable.sectionMm2,
      phases,
    });
    const dropPercent =
      settings.voltageV > 0
        ? (dropVolts / (phases === 3 ? settings.voltageV * THREE_PHASE_FACTOR : settings.voltageV)) * 100
        : 0;
    const faultCurrent = calibrated
      ? faultCurrentA({
          sourceFaultCurrentKa: settings.sourceFaultCurrentKa,
          lengthMeters,
          material: cable.material,
          sectionMm2: cable.sectionMm2,
          voltageV: settings.voltageV,
        })
      : 0;
    const magneticTripA = breaker.ratingA * MAGNETIC_TRIP[breaker.curve];
    const faultTripOk =
      !calibrated || faultCurrent >= magneticTripA;
    const breakingCapacityOk =
      !calibrated ||
      faultCurrent / 1_000 <= breaker.breakingCapacityKa;
    const voltageDropOk = !calibrated || dropPercent <= voltageDropLimitPercent;

    if (devices.length === 0) {
      issues.push(
        issue('circuitNoDevices', 'info', circuit.id, { circuit: circuit.id }),
      );
    } else if (lengthMeters <= 0) {
      issues.push(
        issue('circuitNoRoute', 'info', circuit.id, { circuit: circuit.id }),
      );
    }

    if (ampacityA <= 0) {
      issues.push(
        issue('unknownCableSection', 'error', circuit.id, {
          circuit: circuit.id,
          section: cable.sectionMm2,
        }),
      );
    } else {
      if (currentA > breaker.ratingA + 1e-9) {
        issues.push(
          issue('currentExceedsBreaker', 'error', circuit.id, {
            circuit: circuit.id,
            current: round(currentA),
            rating: breaker.ratingA,
          }),
        );
      }

      if (breaker.ratingA > ampacityA + 1e-9) {
        issues.push(
          issue('breakerExceedsCable', 'error', circuit.id, {
            circuit: circuit.id,
            rating: breaker.ratingA,
            ampacity: round(ampacityA),
            section: cable.sectionMm2,
          }),
        );
      }
    }

    if (!voltageDropOk) {
      issues.push(
        issue('voltageDropExceeded', 'warning', circuit.id, {
          circuit: circuit.id,
          drop: round(dropPercent),
          limit: voltageDropLimitPercent,
        }),
      );
    }

    if (!faultTripOk) {
      issues.push(
        issue('faultCurrentLow', 'warning', circuit.id, {
          circuit: circuit.id,
          fault: Math.round(faultCurrent),
          trip: Math.round(magneticTripA),
        }),
      );
    }

    if (!breakingCapacityOk) {
      issues.push(
        issue('breakingCapacityExceeded', 'error', circuit.id, {
          circuit: circuit.id,
          fault: Math.round(faultCurrent),
          capacity: breaker.breakingCapacityKa,
        }),
      );
    }

    const hasSocket = devices.some((device) => device.type === 'socket');
    if (hasSocket) {
      if (!rcd) {
        issues.push(
          issue('rcdMissing', 'warning', circuit.id, {
            circuit: circuit.id,
          }),
        );
      } else {
        if (rcd.sensitivityMa > STANDARD_RCD_SENSITIVITY_MA) {
          issues.push(
            issue('rcdSensitivityHigh', 'warning', circuit.id, {
              circuit: circuit.id,
              sensitivity: rcd.sensitivityMa,
            }),
          );
        }
        if (rcd.ratingA < breaker.ratingA) {
          issues.push(
            issue('rcdRatingLow', 'warning', circuit.id, {
              circuit: circuit.id,
              rcd: rcd.ratingA,
              rating: breaker.ratingA,
            }),
          );
        }
      }
    }

    if (phases === 3) {
      phaseCurrents.L1 += currentA;
      phaseCurrents.L2 += currentA;
      phaseCurrents.L3 += currentA;
    } else {
      phaseCurrents[phase] += currentA;
    }

    results.push({
      id: circuit.id,
      name: circuit.name ?? circuit.id,
      loadKind,
      phase,
      phases,
      deviceCount: devices.length,
      connectedPowerW: round(connectedPowerW),
      demandFactor: round(demandFactor, 4),
      demandPowerW: round(demandPowerW),
      cosPhi,
      currentA: round(currentA),
      cable: { ...cable, lengthMeters: round(lengthMeters), ampacityA: round(ampacityA) },
      breaker,
      rcd,
      voltageDropVolts: round(dropVolts),
      voltageDropPercent: round(dropPercent),
      voltageDropLimitPercent,
      voltageDropOk,
      faultCurrentA: Math.round(faultCurrent),
      magneticTripA: round(magneticTripA),
      faultTripOk,
      breakingCapacityOk,
    });
  });

  // Devices assigned to a circuit that no longer exists are skipped by the
  // per-circuit loop; surface them instead of silently dropping the load.
  for (const device of orphanDevices) {
    issues.push(
      issue('orphanDevice', 'warning', device.circuitId, {
        circuit: device.circuitId ?? '',
      }),
    );
  }

  const totalConnectedPowerW = results.reduce(
    (total, circuit) => total + circuit.connectedPowerW,
    0,
  );
  const totalDemandPowerW = results.reduce(
    (total, circuit) => total + circuit.demandPowerW,
    0,
  );
  const maxPhaseCurrentA = Math.max(
    phaseCurrents.L1,
    phaseCurrents.L2,
    phaseCurrents.L3,
  );
  const equivalentCurrentA =
    totalDemandPowerW > 0
      ? designCurrent(
          totalDemandPowerW,
          settings.defaultCosPhi,
          settings.supply === 'three-phase' ? 3 : 1,
          settings.voltageV,
        )
      : 0;

  const severityRank: Record<ElectricalSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return {
    settings,
    calibrated,
    circuits: results,
    totalConnectedPowerW: round(totalConnectedPowerW),
    totalDemandPowerW: round(totalDemandPowerW),
    demandFactor:
      totalConnectedPowerW > 0 ? totalDemandPowerW / totalConnectedPowerW : 1,
    phaseCurrents: {
      L1: round(phaseCurrents.L1),
      L2: round(phaseCurrents.L2),
      L3: round(phaseCurrents.L3),
    },
    maxPhaseCurrentA: round(maxPhaseCurrentA),
    equivalentCurrentA: round(equivalentCurrentA),
    recommendedMainBreakerA: nextStandardBreaker(
      Math.max(maxPhaseCurrentA, equivalentCurrentA) * 1.1,
    ),
    worstVoltageDropPercent: results.reduce(
      (worst, circuit) =>
        calibrated ? Math.max(worst, circuit.voltageDropPercent) : worst,
      0,
    ),
    issues: [...issues].sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.code.localeCompare(b.code) ||
        (a.circuitId ?? '').localeCompare(b.circuitId ?? ''),
    ),
  };
}

function phased(
  settings: ElectricalSettings,
  configured: Phase | undefined,
  index: number,
): Phase | null {
  if (settings.supply === 'single-phase') return 'L1';
  if (configured) return configured;

  const phases: Phase[] = ['L1', 'L2', 'L3'];
  return phases[index % phases.length] ?? 'L1';
}
