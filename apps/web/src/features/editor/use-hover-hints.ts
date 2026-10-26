import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dmp:editor:hoverHints';

function defaultEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return defaultEnabled();
  } catch {
    return defaultEnabled();
  }
}

export function useHoverHints() {
  const [hoverHints, setHoverHintsState] = useState(readEnabled);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(hoverHints));
    } catch {
      // Cosmetic preference; ignore blocked storage.
    }
  }, [hoverHints]);

  const setHoverHints = useCallback((value: boolean) => {
    setHoverHintsState(value);
  }, []);

  const toggleHoverHints = useCallback(() => {
    setHoverHintsState((value) => !value);
  }, []);

  return { hoverHints, setHoverHints, toggleHoverHints };
}
