import { useCallback, useEffect, useRef, useState } from 'react';

export type CheckState = 'checking' | 'up' | 'down';

export interface SystemHealth {
  api: CheckState;
  database: CheckState;
  checkedAt: string | null;
}

const initialHealth: SystemHealth = {
  api: 'checking',
  database: 'checking',
  checkedAt: null,
};

async function isUp(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { signal });
    return response.ok;
  } catch {
    return false;
  }
}

export function useSystemHealth(): SystemHealth & { refresh: () => void } {
  const [health, setHealth] = useState<SystemHealth>(initialHealth);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setHealth((current) => ({
      ...current,
      api: 'checking',
      database: 'checking',
    }));

    void (async () => {
      const api = await isUp('/api/v1/health', controller.signal);

      if (!api) {
        setHealth({
          api: 'down',
          database: 'down',
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      const database = await isUp('/api/v1/health/ready', controller.signal);

      if (!controller.signal.aborted) {
        setHealth({
          api: 'up',
          database: database ? 'up' : 'down',
          checkedAt: new Date().toISOString(),
        });
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  return { ...health, refresh };
}
