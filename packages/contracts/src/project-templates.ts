import { z } from 'zod';
import { planDrawingSchema } from './drawing';
import { calculationSettingsSchema } from './floor';
import {
  projectDescriptionSchema,
  projectNameSchema,
} from './project';

/** Stable, URL-safe template identifier (e.g. `apartment_2br`). */
export const projectTemplateCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, digits and underscores');

const localizedNameSchema = z.object({
  ua: z.string().trim().min(1).max(160),
  en: z.string().trim().min(1).max(160),
  ru: z.string().trim().min(1).max(160).optional(),
});

const localizedDescriptionSchema = z.object({
  ua: z.string().trim().min(1).max(1000),
  en: z.string().trim().min(1).max(1000),
  ru: z.string().trim().min(1).max(1000).optional(),
});

/**
 * The template stores a complete drawing plus the plan-wide calculation
 * settings (circuits) so the generated project is usable without extra setup.
 */
export const templatePlanPayloadSchema = planDrawingSchema.extend({
  calculationSettings: calculationSettingsSchema.optional(),
});

export const publicProjectTemplateSchema = z.object({
  id: z.string().uuid(),
  code: projectTemplateCodeSchema,
  name: localizedNameSchema,
  description: localizedDescriptionSchema,
  previewSvg: z.string().min(1),
  roomsCount: z.number().int().nonnegative(),
  devicesCount: z.number().int().nonnegative(),
  circuitsCount: z.number().int().nonnegative(),
});

export const createProjectFromTemplateSchema = z.object({
  templateCode: projectTemplateCodeSchema,
  name: projectNameSchema.optional(),
  description: projectDescriptionSchema.optional(),
  organizationId: z.string().uuid().nullable().optional(),
});

/**
 * Body accepted by `POST /projects`: either an existing explicit name (blank
 * project) or a template code (the template supplies the name if omitted).
 */
export const createProjectBodySchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema.optional(),
    organizationId: z.string().uuid().nullable().optional(),
    templateCode: projectTemplateCodeSchema.optional(),
  })
  .refine((value) => Boolean(value.name) || Boolean(value.templateCode), {
    message: 'Provide a project name or a templateCode',
    path: ['name'],
  });

export type LocalizedTemplateText = z.infer<typeof localizedNameSchema>;
export type PublicProjectTemplate = z.infer<
  typeof publicProjectTemplateSchema
>;
export type CreateProjectFromTemplateInput = z.infer<
  typeof createProjectFromTemplateSchema
>;
export type CreateProjectBodyInput = z.infer<typeof createProjectBodySchema>;
export type TemplatePlanPayload = z.infer<typeof templatePlanPayloadSchema>;
