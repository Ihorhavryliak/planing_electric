import { useCallback, useEffect, useState } from 'react';

export interface EditorLayers {
  walls: boolean;
  openings: boolean;
  rooms: boolean;
  dimensions: boolean;
  points: boolean;
  routes: boolean;
  labels: boolean;
  penetrations: boolean;
}

export const DEFAULT_EDITOR_LAYERS: EditorLayers = {
  walls: true,
  openings: true,
  rooms: true,
  dimensions: true,
  points: true,
  routes: true,
  labels: true,
  penetrations: true,
};

export const EDITOR_LAYER_KEYS = Object.keys(
  DEFAULT_EDITOR_LAYERS,
) as (keyof EditorLayers)[];

const STORAGE_KEY = 'drawmyplace.editor.layers.v1';

/** Normalizes an arbitrary stored value into a complete layer map. */
export function normalizeEditorLayers(value: unknown): EditorLayers {
  if (!value || typeof value !== 'object') {
    return DEFAULT_EDITOR_LAYERS;
  }

  const next = { ...DEFAULT_EDITOR_LAYERS };

  for (const key of EDITOR_LAYER_KEYS) {
    const stored = (value as Record<string, unknown>)[key];

    if (typeof stored === 'boolean') {
      next[key] = stored;
    }
  }

  return next;
}

/** Parses a raw localStorage payload, falling back to all layers visible. */
export function parseEditorLayers(raw: string | null): EditorLayers {
  if (!raw) return DEFAULT_EDITOR_LAYERS;

  try {
    return normalizeEditorLayers(JSON.parse(raw));
  } catch {
    return DEFAULT_EDITOR_LAYERS;
  }
}

/** Reads the saved layer visibility; unknown or invalid values fall back. */
export function loadEditorLayers(): EditorLayers {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_LAYERS;

  try {
    return parseEditorLayers(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_EDITOR_LAYERS;
  }
}

export function saveEditorLayers(layers: EditorLayers): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
  } catch {
    // Storage can be full or blocked; layer visibility is not critical.
  }
}

/** Layer visibility shared by the server and local editors, persisted locally. */
export function useEditorLayers() {
  const [layers, setLayers] = useState<EditorLayers>(loadEditorLayers);

  useEffect(() => {
    saveEditorLayers(layers);
  }, [layers]);

  const toggleLayer = useCallback((key: keyof EditorLayers) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const showAllLayers = useCallback(() => {
    setLayers(DEFAULT_EDITOR_LAYERS);
  }, []);

  return { layers, toggleLayer, showAllLayers };
}
