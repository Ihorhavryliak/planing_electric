import {
  DEFAULT_ONBOARDING_STATE,
  normalizeOnboardingState,
  type OnboardingHint,
  type OnboardingState,
  type OnboardingTourStatus,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/features/auth/auth-context';

export const ONBOARDING_STORAGE_KEY = 'dmp:onboarding';

export type TourMode = 'auto' | 'forced' | 'off';

interface OnboardingContextValue {
  state: OnboardingState;
  loading: boolean;
  tourMode: TourMode;
  /** True while the first-run tour should be open. */
  shouldShowTour: boolean;
  completeTour: () => void;
  skipTour: () => void;
  dismissTour: () => void;
  markHint: (hint: OnboardingHint) => void;
  reset: () => void;
  restartTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function readLocal(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_STATE;

    return normalizeOnboardingState(JSON.parse(raw));
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function writeLocal(state: OnboardingState): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota must not block the editor.
  }
}

function readTourMode(): TourMode {
  const value = new URLSearchParams(window.location.search).get('tour');

  if (value === 'off') return 'off';
  if (value === 'editor') return 'forced';
  return 'auto';
}

function mergeStates(
  local: OnboardingState,
  server: OnboardingState,
): OnboardingState {
  return {
    editorTour: server.editorTour ?? local.editorTour,
    hints: { ...local.hints, ...server.hints },
  };
}

/**
 * First-run onboarding state. It is persisted in localStorage immediately and
 * mirrored to `/users/me/onboarding` for signed-in users so a completed tour
 * does not reappear on another device.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(readLocal);
  const [loading, setLoading] = useState(Boolean(user));
  const [tourMode] = useState<TourMode>(readTourMode);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    void apiRequest<OnboardingState>('/users/me/onboarding', {
      signal: controller.signal,
    })
      .then((server) => {
        if (controller.signal.aborted) return;

        setState((current) => {
          const merged = mergeStates(current, normalizeOnboardingState(server));
          writeLocal(merged);
          return merged;
        });
      })
      .catch(() => {
        // Offline or a transient API error: keep the local state.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [user]);

  const persist = useCallback(
    (next: OnboardingState) => {
      setState(next);
      writeLocal(next);

      if (user) {
        void apiRequest<OnboardingState>('/users/me/onboarding', {
          method: 'PATCH',
          body: JSON.stringify({
            editorTour: next.editorTour,
            hints: next.hints,
          }),
        }).catch(() => {
          // The local copy already records progress; retry on the next action.
        });
      }
    },
    [user],
  );

  const setTourStatus = useCallback(
    (status: OnboardingTourStatus) => {
      setDismissed(true);
      persist({ ...state, editorTour: status });
    },
    [persist, state],
  );

  const completeTour = useCallback(() => setTourStatus('completed'), [setTourStatus]);
  const skipTour = useCallback(() => setTourStatus('skipped'), [setTourStatus]);
  const dismissTour = useCallback(() => setDismissed(true), []);

  const markHint = useCallback(
    (hint: OnboardingHint) => {
      if (state.hints[hint]) return;

      persist({ ...state, hints: { ...state.hints, [hint]: true } });
    },
    [persist, state],
  );

  const reset = useCallback(() => {
    setDismissed(false);
    persist(DEFAULT_ONBOARDING_STATE);
  }, [persist]);

  const restartTour = useCallback(() => {
    setDismissed(false);
    persist({ ...state, editorTour: null });
  }, [persist, state]);

  const shouldShowTour =
    !loading &&
    tourMode !== 'off' &&
    !dismissed &&
    (state.editorTour === null || tourMode === 'forced');

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      loading,
      tourMode,
      shouldShowTour,
      completeTour,
      skipTour,
      dismissTour,
      markHint,
      reset,
      restartTour,
    }),
    [
      state,
      loading,
      tourMode,
      shouldShowTour,
      completeTour,
      skipTour,
      dismissTour,
      markHint,
      reset,
      restartTour,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }

  return context;
}
