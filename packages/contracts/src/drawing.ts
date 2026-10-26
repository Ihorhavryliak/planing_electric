import { z } from 'zod';
import { deviceSubtypeSchema } from './devices';
import { publicOpeningSchema } from './opening';
import {
  publicDimensionSchema,
  publicRoomSchema,
  publicWallSchema,
} from './structure';

const COORD_LIMIT = 10_000_000;

export const lengthUnitSchema = z.enum(['mm', 'cm', 'm']);

export const point2DSchema = z.object({
  x: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
  y: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
});

// ---------------------------------------------------------------- calibration

export const setCalibrationSchema = z
  .object({
    pointA: point2DSchema,
    pointB: point2DSchema,
    realDistance: z
      .number()
      .positive('Real distance must be greater than zero')
      .max(100_000),
    unit: lengthUnitSchema.default('m'),
  })
  .refine((value) => value.pointA.x !== value.pointB.x || value.pointA.y !== value.pointB.y, {
    message: 'Calibration points must not coincide',
    path: ['pointB'],
  });

export const publicCalibrationSchema = z.object({
  planId: z.string().uuid(),
  pointA: point2DSchema,
  pointB: point2DSchema,
  realDistance: z.number(),
  unit: lengthUnitSchema,
  /** Real meters represented by one drawing unit. */
  metersPerUnit: z.number().positive(),
  updatedAt: z.string().datetime(),
});

// --------------------------------------------------------- electrical points

export const electricalPointTypeSchema = z.enum([
  'socket',
  'switch',
  'light',
  'panel',
  'junction',
  'custom',
]);

export const pointPropertiesSchema = z
  .object({
    /** Overrides the default vertical cable drop for this point (meters). */
    verticalDropMeters: z.number().min(0).max(100).optional(),
    /** Circuit code from the plan's circuit list. */
    circuitId: z.string().trim().min(1).max(40).nullable().optional(),
    /** Catalog subtype (double socket, dimmer, LAN point, ...). */
    subtype: deviceSubtypeSchema.nullable().optional(),
  })
  .strict();

const pointLabelSchema = z.string().trim().max(60);

export const createPointSchema = z.object({
  type: electricalPointTypeSchema,
  x: point2DSchema.shape.x,
  y: point2DSchema.shape.y,
  rotation: z.number().min(-360).max(360).default(0),
  label: pointLabelSchema.nullable().optional(),
  mountingHeight: z.number().min(0).max(100).nullable().optional(),
  properties: pointPropertiesSchema.default({}),
});

export const updatePointSchema = z
  .object({
    type: electricalPointTypeSchema.optional(),
    x: point2DSchema.shape.x.optional(),
    y: point2DSchema.shape.y.optional(),
    rotation: z.number().min(-360).max(360).optional(),
    label: pointLabelSchema.nullable().optional(),
    mountingHeight: z.number().min(0).max(100).nullable().optional(),
    properties: pointPropertiesSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicPointSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  type: electricalPointTypeSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  label: z.string().nullable(),
  mountingHeight: z.number().nullable(),
  properties: pointPropertiesSchema,
  updatedAt: z.string().datetime(),
});

// ------------------------------------------------------------- cable routes

export const MAX_ROUTE_VERTICES = 500;

export const routeGeometrySchema = z
  .array(point2DSchema)
  .min(2, 'A route needs at least two points')
  .max(MAX_ROUTE_VERTICES);

export const routeSettingsSchema = z
  .object({
    /** Waste allowance in percent; the default (10) applies when omitted. */
    wastePercent: z.number().min(0).max(100).optional(),
  })
  .strict();

const circuitIdSchema = z.string().trim().min(1).max(40);

export const createRouteSchema = z.object({
  geometry: routeGeometrySchema,
  circuitId: circuitIdSchema.nullable().optional(),
  materialId: z.string().uuid().nullable().optional(),
  settings: routeSettingsSchema.default({}),
});

export const updateRouteSchema = z
  .object({
    geometry: routeGeometrySchema.optional(),
    circuitId: circuitIdSchema.nullable().optional(),
    materialId: z.string().uuid().nullable().optional(),
    settings: routeSettingsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicRouteSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  circuitId: z.string().nullable(),
  materialId: z.string().uuid().nullable(),
  geometry: routeGeometrySchema,
  settings: routeSettingsSchema,
  updatedAt: z.string().datetime(),
});

// ------------------------------------------------------------ drawing & calc

export const planDrawingSchema = z.object({
  planId: z.string().uuid(),
  calibration: publicCalibrationSchema.nullable(),
  walls: z.array(publicWallSchema),
  openings: z.array(publicOpeningSchema),
  rooms: z.array(publicRoomSchema),
  dimensions: z.array(publicDimensionSchema),
  points: z.array(publicPointSchema),
  routes: z.array(publicRouteSchema),
});

export const routeCalculationSchema = z.object({
  routeId: z.string().uuid(),
  circuitId: z.string().nullable(),
  status: z.enum(['ok', 'uncalibrated']),
  planLength: z.number().nullable(),
  verticalLength: z.number().nullable(),
  wastePercent: z.number().nullable(),
  wasteLength: z.number().nullable(),
  requiredLength: z.number().nullable(),
  drops: z.array(
    z.object({
      pointId: z.string().uuid(),
      label: z.string(),
      meters: z.number(),
    }),
  ),
  warnings: z.array(z.string()),
});

export const planCalculationSchema = z.object({
  planId: z.string().uuid(),
  metersPerUnit: z.number().positive().nullable(),
  routes: z.array(routeCalculationSchema),
  /** Sum of required lengths; null while the plan is not calibrated. */
  totalRequiredLength: z.number().nullable(),
  warnings: z.array(z.string()),
});

export type LengthUnitInput = z.infer<typeof lengthUnitSchema>;
export type Point2DInput = z.infer<typeof point2DSchema>;
export type SetCalibrationInput = z.input<typeof setCalibrationSchema>;
export type PublicCalibration = z.infer<typeof publicCalibrationSchema>;
export type ElectricalPointType = z.infer<typeof electricalPointTypeSchema>;
export type CreatePointInput = z.infer<typeof createPointSchema>;
export type UpdatePointInput = z.infer<typeof updatePointSchema>;
export type PublicPoint = z.infer<typeof publicPointSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type PublicRoute = z.infer<typeof publicRouteSchema>;
export type PlanDrawing = z.infer<typeof planDrawingSchema>;
export type RouteCalculation = z.infer<typeof routeCalculationSchema>;
export type PlanCalculation = z.infer<typeof planCalculationSchema>;
