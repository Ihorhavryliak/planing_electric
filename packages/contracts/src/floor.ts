import { z } from 'zod';

const dropDefault = z.number().min(0).max(100).optional();

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

export type FloorNameInput = z.infer<typeof floorNameSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type PlanSourceType = z.infer<typeof planSourceTypeSchema>;
export type UnderlaySettings = z.infer<typeof underlaySettingsSchema>;
export type EditorViewport = z.infer<typeof editorViewportSchema>;
export type PublicPlan = z.infer<typeof publicPlanSchema>;
export type PublicFloor = z.infer<typeof publicFloorSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
