import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAKEOFF_SETTINGS,
  normalizeTakeoffSettings,
  parseTakeoffSettings,
} from './takeoff-settings';

describe('takeoff settings', () => {
  it('falls back to wall defaults', () => {
    expect(parseTakeoffSettings(null)).toEqual(DEFAULT_TAKEOFF_SETTINGS);
    expect(parseTakeoffSettings('not-json')).toEqual(DEFAULT_TAKEOFF_SETTINGS);
  });

  it('restores valid values and clamps invalid ones', () => {
    expect(
      parseTakeoffSettings(
        JSON.stringify({ wallHeightMeters: 3.2, defaultThicknessMeters: 0.2 }),
      ),
    ).toEqual({ wallHeightMeters: 3.2, defaultThicknessMeters: 0.2 });

    expect(
      normalizeTakeoffSettings({
        wallHeightMeters: 20,
        defaultThicknessMeters: 0,
      }),
    ).toEqual(DEFAULT_TAKEOFF_SETTINGS);
  });
});
