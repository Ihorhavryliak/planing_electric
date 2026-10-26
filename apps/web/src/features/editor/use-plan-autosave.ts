import type {
  EditorViewport,
  PublicPlan,
  UnderlaySettings,
} from '@drawmyplace/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { updatePlan } from './editor-api';
import { getErrorMessage } from '@/lib/api';

export type AutosaveStatus = 'saved' | 'pending' | 'saving' | 'error';

interface PlanAutosave {
  status: AutosaveStatus;
  error: string | null;
  retry: () => void;
}

interface UsePlanAutosaveOptions {
  plan: PublicPlan;
  underlay: UnderlaySettings;
  viewport: EditorViewport;
  onPlanChange: (plan: PublicPlan) => void;
}

function serialize(
  underlay: UnderlaySettings,
  viewport: EditorViewport,
): string {
  return JSON.stringify({ underlay, viewport });
}

export function usePlanAutosave({
  plan,
  underlay,
  viewport,
  onPlanChange,
}: UsePlanAutosaveOptions): PlanAutosave {
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const lastSavedRef = useRef(
    serialize(plan.underlay, plan.viewport),
  );
  const latestRef = useRef({ underlay, viewport });
  latestRef.current = { underlay, viewport };
  // Circuit edits and other plan patches also bump the version; always send the
  // newest one so an autosave started before them cannot conflict.
  const planVersionRef = useRef(plan.version);
  planVersionRef.current = plan.version;

  const onPlanChangeRef = useRef(onPlanChange);
  onPlanChangeRef.current = onPlanChange;

  const mountedRef = useRef(true);
  const saveGenerationRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef<{
    state: { underlay: UnderlaySettings; viewport: EditorViewport };
    serialized: string;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveNow = useCallback(
    async (
      state: { underlay: UnderlaySettings; viewport: EditorViewport },
      serialized: string,
    ) => {
      if (inFlightRef.current) {
        queuedRef.current = { state, serialized };
        return;
      }

      inFlightRef.current = true;
      saveGenerationRef.current += 1;
      const generation = saveGenerationRef.current;

      setStatus('saving');
      setError(null);

      try {
        const updated = await updatePlan(plan.id, {
          underlay: state.underlay,
          viewport: state.viewport,
          expectedVersion: planVersionRef.current,
        });

        if (!mountedRef.current) {
          return;
        }

        lastSavedRef.current = serialized;
        planVersionRef.current = Math.max(
          planVersionRef.current,
          updated.version,
        );
        onPlanChangeRef.current(updated);

        if (saveGenerationRef.current === generation) {
          const latest = latestRef.current;
          const latestSerialized = serialize(
            latest.underlay,
            latest.viewport,
          );

          setStatus(latestSerialized === serialized ? 'saved' : 'pending');
        }
      } catch (saveError) {
        if (mountedRef.current && saveGenerationRef.current === generation) {
          setError(getErrorMessage(saveError));
          setStatus('error');
        }
      } finally {
        inFlightRef.current = false;
        const queued = queuedRef.current;
        queuedRef.current = null;

        if (queued && queued.serialized !== lastSavedRef.current) {
          void saveNow(queued.state, queued.serialized);
        }
      }
    },
    [plan.id],
  );

  useEffect(() => {
    const serialized = serialize(underlay, viewport);

    if (serialized === lastSavedRef.current) {
      setStatus('saved');
      setError(null);
      return;
    }

    setStatus('pending');
    setError(null);

    const timer = window.setTimeout(() => {
      void saveNow({ underlay, viewport }, serialized);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [underlay, viewport, saveNow]);

  const retry = useCallback(() => {
    const state = latestRef.current;

    void saveNow(state, serialize(state.underlay, state.viewport));
  }, [saveNow]);

  useEffect(() => {
    if (status === 'saved') {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);

    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [status]);

  return { status, error, retry };
}
