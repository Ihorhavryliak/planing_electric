import { z } from 'zod';

export const estimateStatusSchema = z.enum(['draft', 'final']);

export const estimateTypeSchema = z.enum(['power', 'signaling']);
export type EstimateType = z.infer<typeof estimateTypeSchema>;

export const publicEstimateItemSchema = z.object({
  id: z.string().uuid(),
  estimateId: z.string().uuid(),
  materialId: z.string().uuid().nullable(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number(),
  purchaseQuantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  subtotal: z.number().nullable(),
  isOverridden: z.boolean(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const publicEstimateSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.number().int(),
  type: estimateTypeSchema.default('power'),
  status: estimateStatusSchema,
  calculationSettings: z.record(z.string(), z.unknown()).default({}),
  warnings: z.array(z.string()).default([]),
  items: z.array(publicEstimateItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateEstimateSchema = z.object({
  status: estimateStatusSchema,
});

export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const updateEstimateItemSchema = z
  .object({
    quantity: z.number().min(0).optional(),
    purchaseQuantity: z.number().min(0).nullable().optional(),
    unitPrice: z.number().min(0).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    isOverridden: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export type UpdateEstimateItemInput = z.infer<typeof updateEstimateItemSchema>;

export type PublicEstimate = z.infer<typeof publicEstimateSchema>;
export type PublicEstimateItem = z.infer<typeof publicEstimateItemSchema>;
