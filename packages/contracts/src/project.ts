import { z } from 'zod';

export const projectStatusSchema = z.enum(['active', 'archived']);

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(120, 'Project name must be at most 120 characters');

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description must be at most 2000 characters');

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema.optional(),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema.nullable().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    { message: 'Provide at least one field to update' },
  );

export const projectListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export const publicProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  revision: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type PublicProject = z.infer<typeof publicProjectSchema>;
