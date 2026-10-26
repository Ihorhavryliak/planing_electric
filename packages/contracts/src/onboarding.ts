import { z } from 'zod';

/** One-time onboarding milestones stored for the signed-in user. */
export const ONBOARDING_HINTS = [
  'first-point',
  'first-route',
  'first-circuit',
  'command-palette',
  'three-d-view',
  'documentation',
] as const;

export const onboardingHintSchema = z.enum(ONBOARDING_HINTS);
export type OnboardingHint = z.infer<typeof onboardingHintSchema>;

export const onboardingTourStatusSchema = z.enum(['completed', 'skipped']);
export type OnboardingTourStatus = z.infer<typeof onboardingTourStatusSchema>;

export const onboardingStateSchema = z.object({
  editorTour: onboardingTourStatusSchema.nullable(),
  hints: z.record(z.string().max(60), z.boolean()),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  editorTour: null,
  hints: {},
};

export const updateOnboardingSchema = z
  .object({
    editorTour: onboardingTourStatusSchema.nullable().optional(),
    hints: z.record(z.string().max(60), z.boolean()).optional(),
  })
  .refine(
    (value) => value.editorTour !== undefined || value.hints !== undefined,
    { message: 'Provide at least one onboarding field' },
  );

export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export function normalizeOnboardingState(
  value: unknown,
): OnboardingState {
  const parsed = onboardingStateSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_ONBOARDING_STATE;
}
