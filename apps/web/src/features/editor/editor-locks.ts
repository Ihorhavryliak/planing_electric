import { useCallback, useEffect, useState } from 'react';

export type LockableKind =
  | 'wall'
  | 'room'
  | 'route'
  | 'opening'
  | 'dimension';

const STORAGE_KEY = 'dmp:editor:locks';

function lockKey(kind: LockableKind, id: string): string {
  return `${kind}:${id}`;
}

function loadLocks(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Pins walls, rooms, routes, openings and dimensions locally. Points keep
 * their server-side `properties.locked` flag.
 */
export function useEditorLocks() {
  const [locks, setLocks] = useState<Set<string>>(loadLocks);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...locks]));
    } catch {
      // Locking is a convenience; ignore blocked storage.
    }
  }, [locks]);

  const isLocked = useCallback(
    (kind: LockableKind, id: string | null | undefined) =>
      Boolean(id && locks.has(lockKey(kind, id))),
    [locks],
  );

  const toggleLock = useCallback((kind: LockableKind, id: string) => {
    setLocks((current) => {
      const next = new Set(current);
      const key = lockKey(kind, id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { isLocked, toggleLock, locks };
}
