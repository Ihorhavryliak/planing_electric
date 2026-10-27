import { z } from 'zod';
import { signalingSettingsSchema } from './signaling';

const dropDefault = z.number().min(0).max(100).optional();

export const circuitSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f59e0b'),
  note: z.string().trim().max(500).nullable().optional(),
});

export const circuitsSchema = z.array(circuitSchema).max(200);

export const validationRulesSchema = z
  .object({
    maxCircuitLengthMeters: z.number().positive().max(100_000).optional(),
    requireCableType: z.boolean().optional(),
  })
  .partial();

export const conductorMaterialSchema = z.enum(['copper', 'aluminium']);

export const breakerCurveSchema = z.enum(['B', 'C', 'D']);

export const loadKindSchema = z.enum(['lighting', 'power', 'mixed']);

export const supplyTypeSchema = z.enum(['single-phase', 'three-phase']);

export const phaseSchema = z.enum(['L1', 'L2', 'L3']);

export const cableSettingsSchema = z.object({
  material: conductorMaterialSchema,
  sectionMm2: z.number().positive().max(1_000),
  lengthMeters: z.number().min(0).max(100_000).nullable(),
});

export const breakerSettingsSchema = z.object({
  ratingA: z.number().positive().max(2_000),
  curve: breakerCurveSchema,
  breakingCapacityKa: z.number().positive().max(200),
  poles: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export const rcdSettingsSchema = z.object({
  ratingA: z.number().positive().max(2_000),
  sensitivityMa: z.number().positive().max(1_000),
  poles: z.union([z.literal(2), z.literal(4)]).optional(),
});

export const circuitElectricalSettingsSchema = z
  .object({
    loadKind: loadKindSchema,
    cosPhi: z.number().min(0.5).max(1),
    phase: phaseSchema,
    phases: z.union([z.literal(1), z.literal(3)]),
    cable: cableSettingsSchema.partial(),
    breaker: breakerSettingsSchema.partial(),
    /** null disables the RCD for this circuit. */
    rcd: rcdSettingsSchema.partial().nullable(),
  })
  .partial();

export const panelBoardSchema = z
  .object({
    name: z.string().trim().max(80),
    location: z.string().trim().max(120).nullable(),
    rows: z.number().int().min(1).max(20),
    waysPerRow: z.number().int().min(1).max(24),
    mainBreaker: breakerSettingsSchema.partial(),
    rcd: rcdSettingsSchema.partial().nullable(),
  })
  .partial();

export const electricalSettingsSchema = z
  .object({
    supply: supplyTypeSchema,
    voltageV: z.number().min(100).max(1_000),
    defaultCosPhi: z.number().min(0.5).max(1),
    defaultCable: cableSettingsSchema.partial(),
    defaultBreaker: breakerSettingsSchema.partial(),
    /** null disables the default RCD. */
    defaultRcd: rcdSettingsSchema.partial().nullable(),
    sourceFaultCurrentKa: z.number().positive().max(200),
    maxVoltageDropLightingPercent: z.number().positive().max(100),
    maxVoltageDropPowerPercent: z.number().positive().max(100),
    circuits: z.record(z.string(), circuitElectricalSettingsSchema),
    board: panelBoardSchema,
  })
  .partial();

export const calculationSettingsSchema = z.object({
  verticalDropDefaults: z
    .object({
      socket: dropDefault,
      switch: dropDefault,
      light: dropDefault,
      panel: dropDefault,
      junction: dropDefault,
      custom: dropDefault,
    })
    .partial()
    .optional(),
  validation: validationRulesSchema.optional(),
  circuits: circuitsSchema.optional(),
  electrical: electricalSettingsSchema.optional(),
  signaling: signalingSettingsSchema.optional(),
});

export const floorNameSchema = z
  .string()
  .trim()
  .min(1, 'Floor name is required')
  .max(80, 'Floor name must be at most 80 characters');

export const createFloorSchema = z.object({
  name: floorNameSchema,
});

export const planSourceTypeSchema = z.enum(['blank', 'upload']);

export const underlaySettingsSchema = z.object({
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().min(0.05).max(1).default(1),
  rotation: z.number().min(-360).max(360).default(0),
  scale: z.number().min(0.05).max(10).default(1),
  offsetX: z.number().min(-1_000_000).max(1_000_000).default(0),
  offsetY: z.number().min(-1_000_000).max(1_000_000).default(0),
});

export const editorViewportSchema = z.object({
  x: z.number().min(-10_000_000).max(10_000_000),
  y: z.number().min(-10_000_000).max(10_000_000),
  zoom: z.number().min(0.02).max(8),
});

export const publicPlanSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  sourceType: planSourceTypeSchema,
  mimeType: z.string().nullable(),
  page: z.number().int().nullable(),
  hasFile: z.boolean(),
  hasPreview: z.boolean(),
  underlay: underlaySettingsSchema,
  viewport: editorViewportSchema,
  calculationSettings: calculationSettingsSchema.default({}),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicFloorSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  plan: publicPlanSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updatePlanSchema = z
  .object({
    underlay: underlaySettingsSchema.optional(),
    viewport: editorViewportSchema.optional(),
    calculationSettings: calculationSettingsSchema.optional(),
    page: z.number().int().min(1).max(1000).nullable().optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine(
    (value) =>
      value.underlay !== undefined ||
      value.viewport !== undefined ||
      value.calculationSettings !== undefined ||
      value.page !== undefined ||
      value.expectedVersion !== undefined,
    { message: 'Provide at least one field to update' },
  );

export type Circuit = z.infer<typeof circuitSchema>;
export type ConductorMaterial = z.infer<typeof conductorMaterialSchema>;
export type BreakerCurve = z.infer<typeof breakerCurveSchema>;
export type LoadKind = z.infer<typeof loadKindSchema>;
export type SupplyType = z.infer<typeof supplyTypeSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type CableSettings = z.infer<typeof cableSettingsSchema>;
export type BreakerSettings = z.infer<typeof breakerSettingsSchema>;
export type RcdSettings = z.infer<typeof rcdSettingsSchema>;
export type CircuitElectricalSettings = z.infer<
  typeof circuitElectricalSettingsSchema
>;
export type ElectricalSettings = z.infer<typeof electricalSettingsSchema>;
export type PanelBoard = z.infer<typeof panelBoardSchema>;
export type FloorNameInput = z.infer<typeof floorNameSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type PlanSourceType = z.infer<typeof planSourceTypeSchema>;
export type UnderlaySettings = z.infer<typeof underlaySettingsSchema>;
export type EditorViewport = z.infer<typeof editorViewportSchema>;
export type PublicPlan = z.infer<typeof publicPlanSchema>;
export type PublicFloor = z.infer<typeof publicFloorSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
