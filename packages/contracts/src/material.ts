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

export type PublicMaterial = z.infer<typeof publicMaterialSchema>;
