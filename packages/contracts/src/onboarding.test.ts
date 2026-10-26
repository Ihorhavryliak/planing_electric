import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ONBOARDING_STATE,
  normalizeOnboardingState,
  onboardingStateSchema,
  updateOnboardingSchema,
} from './onboarding';

describe('onboarding contracts', () => {
  it('accepts the default state and preserves hints', () => {
    expect(onboardingStateSchema.parse(DEFAULT_ONBOARDING_STATE)).toEqual(
      DEFAULT_ONBOARDING_STATE,
    );
    expect(
      onboardingStateSchema.parse({
        editorTour: 'completed',
        hints: { 'first-route': true },
      }),
    ).toEqual({ editorTour: 'completed', hints: { 'first-route': true } });
  });

  it('normalizes malformed stored values', () => {
    expect(normalizeOnboardingState(null)).toEqual(DEFAULT_ONBOARDING_STATE);
    expect(normalizeOnboardingState({ editorTour: 'broken' })).toEqual(
      DEFAULT_ONBOARDING_STATE,
    );
  });

  it('requires at least one update field', () => {
    expect(updateOnboardingSchema.safeParse({}).success).toBe(false);
    expect(
      updateOnboardingSchema.safeParse({ editorTour: 'skipped' }).success,
    ).toBe(true);
    expect(
      updateOnboardingSchema.safeParse({ hints: { 'three-d-view': true } })
        .success,
    ).toBe(true);
  });
});
