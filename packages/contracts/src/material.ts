import { z } from 'zod';

export const materialCategorySchema = z.enum([
  'cable',
  'conduit',
  'accessory',
  'other',
]);

export const publicMaterialSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  category: materialCategorySchema.nullable(),
  unitPrice: z.number().nullable(),
  currency: z.string(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createMaterialSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(24),
  category: materialCategorySchema.nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  currency: z.string().trim().min(1).max(8).default('UAH'),
  organizationId: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export const updateMaterialSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    unit: z.string().trim().min(1).max(24).optional(),
    category: materialCategorySchema.nullable().optional(),
    unitPrice: z.number().min(0).nullable().optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type PublicMaterial = z.infer<typeof publicMaterialSchema>;
