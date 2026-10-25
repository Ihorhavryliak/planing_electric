import { z } from 'zod';

export const organizationRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'electrician',
  'viewer',
]);

export const organizationNameSchema = z
  .string()
  .trim()
  .min(1, 'Organization name is required')
  .max(120, 'Organization name must be at most 120 characters');

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
  })
  .refine((value) => value.name !== undefined, {
    message: 'Provide at least one field to update',
  });

export const publicOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  settings: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicOrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: organizationRoleSchema,
  status: z.enum(['active', 'invited', 'suspended']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const addOrganizationMemberSchema = z.object({
  userId: z.string().uuid(),
  role: organizationRoleSchema.default('viewer'),
});

export const updateOrganizationMemberSchema = z.object({
  role: organizationRoleSchema.optional(),
  status: z.enum(['active', 'invited', 'suspended']).optional(),
});

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type PublicOrganization = z.infer<typeof publicOrganizationSchema>;
export type PublicOrganizationMember = z.infer<
  typeof publicOrganizationMemberSchema
>;
export type AddOrganizationMemberInput = z.infer<
  typeof addOrganizationMemberSchema
>;
export type UpdateOrganizationMemberInput = z.infer<
  typeof updateOrganizationMemberSchema
>;