import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_WALL_HEIGHT_METERS,
  DEFAULT_WALL_THICKNESS_METERS,
} from '@drawmyplace/calculations';

export interface TakeoffSettings {
  wallHeightMeters: number;
  defaultThicknessMeters: number;
}

export const DEFAULT_TAKEOFF_SETTINGS: TakeoffSettings = {
  wallHeightMeters: DEFAULT_WALL_HEIGHT_METERS,
  defaultThicknessMeters: DEFAULT_WALL_THICKNESS_METERS,
};

const STORAGE_KEY = 'drawmyplace.editor.takeoff.v1';

export function normalizeTakeoffSettings(value: unknown): TakeoffSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_TAKEOFF_SETTINGS;
  }

  const source = value as Record<string, unknown>;
  const height = source.wallHeightMeters;
  const thickness = source.defaultThicknessMeters;

  return {
    wallHeightMeters:
      typeof height === 'number' && Number.isFinite(height) && height >= 2 && height <= 6
        ? height
        : DEFAULT_WALL_HEIGHT_METERS,
    defaultThicknessMeters:
      typeof thickness === 'number' &&
      Number.isFinite(thickness) &&
      thickness >= 0.05 &&
      thickness <= 0.5
        ? thickness
        : DEFAULT_WALL_THICKNESS_METERS,
  };
}

export function parseTakeoffSettings(raw: string | null): TakeoffSettings {
  if (!raw) return DEFAULT_TAKEOFF_SETTINGS;

  try {
    return normalizeTakeoffSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_TAKEOFF_SETTINGS;
  }
}

export function loadTakeoffSettings(): TakeoffSettings {
  if (typeof window === 'undefined') return DEFAULT_TAKEOFF_SETTINGS;

  try {
    return parseTakeoffSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_TAKEOFF_SETTINGS;
  }
}

export function saveTakeoffSettings(settings: TakeoffSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked; takeoff still works with current values.
  }
}

/** Wall height and default thickness shared by the takeoff panel and editors. */
export function useTakeoffSettings() {
  const [settings, setSettings] = useState<TakeoffSettings>(loadTakeoffSettings);

  useEffect(() => {
    saveTakeoffSettings(settings);
  }, [settings]);

  const setWallHeight = useCallback((value: number) => {
    setSettings((current) =>
      normalizeTakeoffSettings({ ...current, wallHeightMeters: value }),
    );
  }, []);

  const setDefaultThickness = useCallback((value: number) => {
    setSettings((current) =>
      normalizeTakeoffSettings({ ...current, defaultThicknessMeters: value }),
    );
  }, []);

  return { settings, setWallHeight, setDefaultThickness };
}
