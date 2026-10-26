import { z } from 'zod';

export const openingTypeSchema = z.enum(['door', 'window']);

const openingLabelSchema = z.string().trim().max(80);

export const createOpeningSchema = z.object({
  wallId: z.string().uuid(),
  type: openingTypeSchema,
  /** Distance from the wall start to the opening start, drawing units. */
  offset: z.number().min(0).max(10_000_000),
  width: z.number().positive().max(10_000_000),
  /** Opening height in the same drawing units (defaults to 2.1 m in mm-derived units). */
  height: z.number().positive().max(10_000_000).optional(),
  sillHeight: z.number().min(0).max(10_000_000).optional(),
  flipped: z.boolean().optional(),
  label: openingLabelSchema.nullable().optional(),
});

export const updateOpeningSchema = z
  .object({
    wallId: z.string().uuid().optional(),
    type: openingTypeSchema.optional(),
    offset: z.number().min(0).max(10_000_000).optional(),
    width: z.number().positive().max(10_000_000).optional(),
    height: z.number().positive().max(10_000_000).optional(),
    sillHeight: z.number().min(0).max(10_000_000).optional(),
    flipped: z.boolean().optional(),
    label: openingLabelSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicOpeningSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  wallId: z.string().uuid(),
  type: openingTypeSchema,
  offset: z.number(),
  width: z.number(),
  height: z.number(),
  sillHeight: z.number(),
  flipped: z.boolean(),
  label: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type OpeningType = z.infer<typeof openingTypeSchema>;
export type CreateOpeningInput = z.infer<typeof createOpeningSchema>;
export type UpdateOpeningInput = z.infer<typeof updateOpeningSchema>;
export type PublicOpening = z.infer<typeof publicOpeningSchema>;
