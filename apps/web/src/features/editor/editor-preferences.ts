import { useCallback, useEffect, useState } from 'react';

export const UI_SCALES = [0.9, 1, 1.1, 1.2] as const;

export interface EditorPreferences {
  uiScale: number;
  /** True only when both sidebars are collapsed; kept for older callers. */
  sidebarCollapsed: boolean;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  uiScale: 1,
  sidebarCollapsed: false,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
};

const STORAGE_KEY = 'drawmyplace.editor.preferences.v1';

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const source = value as Record<string, unknown>;
  const scale = source.uiScale;
  // `sidebarCollapsed` was the old "hide both" flag; migrate it to both sides.
  const legacy =
    typeof source.sidebarCollapsed === 'boolean'
      ? source.sidebarCollapsed
      : false;
  const left =
    typeof source.leftSidebarCollapsed === 'boolean'
      ? source.leftSidebarCollapsed
      : legacy;
  const right =
    typeof source.rightSidebarCollapsed === 'boolean'
      ? source.rightSidebarCollapsed
      : legacy;

  return {
    uiScale:
      typeof scale === 'number' && UI_SCALES.includes(scale as (typeof UI_SCALES)[number])
        ? scale
        : DEFAULT_EDITOR_PREFERENCES.uiScale,
    leftSidebarCollapsed: left,
    rightSidebarCollapsed: right,
    sidebarCollapsed: left && right,
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
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) return parseEditorPreferences(raw);

    // On a phone the stacked sidebars push the plan off-screen; start with the
    // canvas visible. An explicit stored preference always wins.
    let narrow = false;
    try {
      narrow = window.matchMedia?.('(max-width: 1023px)').matches ?? false;
    } catch {
      narrow = false;
    }

    return {
      ...DEFAULT_EDITOR_PREFERENCES,
      sidebarCollapsed: narrow,
      leftSidebarCollapsed: narrow,
      rightSidebarCollapsed: narrow,
    };
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
    setPreferences((current) => {
      const collapse = !(
        current.leftSidebarCollapsed && current.rightSidebarCollapsed
      );

      return {
        ...current,
        leftSidebarCollapsed: collapse,
        rightSidebarCollapsed: collapse,
        sidebarCollapsed: collapse,
      };
    });
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      leftSidebarCollapsed: !current.leftSidebarCollapsed,
      sidebarCollapsed:
        !current.leftSidebarCollapsed && current.rightSidebarCollapsed,
    }));
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      rightSidebarCollapsed: !current.rightSidebarCollapsed,
      sidebarCollapsed:
        current.leftSidebarCollapsed && !current.rightSidebarCollapsed,
    }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setPreferences((current) => ({
      ...current,
      leftSidebarCollapsed: sidebarCollapsed,
      rightSidebarCollapsed: sidebarCollapsed,
      sidebarCollapsed,
    }));
  }, []);

  const setLeftSidebarCollapsed = useCallback(
    (leftSidebarCollapsed: boolean) => {
      setPreferences((current) => ({
        ...current,
        leftSidebarCollapsed,
        sidebarCollapsed:
          leftSidebarCollapsed && current.rightSidebarCollapsed,
      }));
    },
    [],
  );

  const setRightSidebarCollapsed = useCallback(
    (rightSidebarCollapsed: boolean) => {
      setPreferences((current) => ({
        ...current,
        rightSidebarCollapsed,
        sidebarCollapsed:
          current.leftSidebarCollapsed && rightSidebarCollapsed,
      }));
    },
    [],
  );

  return {
    preferences,
    setUiScale,
    toggleSidebar,
    toggleLeftSidebar,
    toggleRightSidebar,
    setSidebarCollapsed,
    setLeftSidebarCollapsed,
    setRightSidebarCollapsed,
  };
}
