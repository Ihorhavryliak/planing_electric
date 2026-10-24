import { useCallback, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';

export interface LogoutState {
  loggingOut: boolean;
  logoutError: string | null;
  signOut: () => Promise<void>;
}

export function useLogout(): LogoutState {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
    } catch (error) {
      setLogoutError(getErrorMessage(error));
      setLoggingOut(false);
    }
  }, [logout]);

  return { loggingOut, logoutError, signOut };
}
