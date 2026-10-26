import { z } from 'zod';

export const variantStatusSchema = z.enum(['active', 'archived']);

export const createVariantSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const updateVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: variantStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const variantMaterialUsageSchema = z.object({
  materialId: z.string().uuid().nullable(),
  name: z.string().nullable(),
  quantity: z.number(),
});

export const variantMetricsSchema = z.object({
  totalRequiredLength: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  routeCount: z.number().int(),
  pointCount: z.number().int(),
  warningCount: z.number().int(),
  materials: z.array(variantMaterialUsageSchema),
});

export const publicVariantSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  status: variantStatusSchema,
  metrics: variantMetricsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type VariantMetrics = z.infer<typeof variantMetricsSchema>;
export type PublicVariant = z.infer<typeof publicVariantSchema>;
