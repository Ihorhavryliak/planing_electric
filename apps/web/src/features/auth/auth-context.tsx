import type {
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@drawmyplace/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, apiRequest } from '@/lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const current = await apiRequest<PublicUser>('/users/me', {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setUser(current);
          setStatus('authenticated');
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (!(error instanceof ApiError && error.status === 401)) {
          console.error('Unable to load the current session', error);
        }

        setUser(null);
        setStatus('anonymous');
      }
    })();

    return () => controller.abort();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const current = await apiRequest<PublicUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    setUser(current);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const current = await apiRequest<PublicUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    setUser(current);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }

  return context;
}
