import { useCallback, useEffect, useState } from 'react';

export const UI_SCALES = [0.9, 1, 1.1, 1.2] as const;

export interface EditorPreferences {
  uiScale: number;
  sidebarCollapsed: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  uiScale: 1,
  sidebarCollapsed: false,
};

const STORAGE_KEY = 'drawmyplace.editor.preferences.v1';

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const source = value as Record<string, unknown>;
  const scale = source.uiScale;

  return {
    uiScale:
      typeof scale === 'number' && UI_SCALES.includes(scale as (typeof UI_SCALES)[number])
        ? scale
        : DEFAULT_EDITOR_PREFERENCES.uiScale,
    sidebarCollapsed:
      typeof source.sidebarCollapsed === 'boolean'
        ? source.sidebarCollapsed
        : DEFAULT_EDITOR_PREFERENCES.sidebarCollapsed,
  };
}

export function parseEditorPreferences(raw: string | null): EditorPreferences {
  if (!raw) return DEFAULT_EDITOR_PREFERENCES;

  try {
    return normalizeEditorPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_EDITOR_PREFERENCES;
  }
}

export function loadEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_PREFERENCES;

  try {
    return parseEditorPreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_EDITOR_PREFERENCES;
  }
}

export function saveEditorPreferences(preferences: EditorPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are cosmetic; ignore blocked storage.
  }
}

export function useEditorPreferences() {
  const [preferences, setPreferences] = useState<EditorPreferences>(
    loadEditorPreferences,
  );

  useEffect(() => {
    saveEditorPreferences(preferences);
  }, [preferences]);

  const setUiScale = useCallback((uiScale: number) => {
    setPreferences((current) =>
      normalizeEditorPreferences({ ...current, uiScale }),
    );
  }, []);

  const toggleSidebar = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      sidebarCollapsed: !current.sidebarCollapsed,
    }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setPreferences((current) => ({ ...current, sidebarCollapsed }));
  }, []);

  return { preferences, setUiScale, toggleSidebar, setSidebarCollapsed };
}
