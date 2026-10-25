import { apiRequest } from '@/lib/api';

export function requestPasswordReset(
  email: string,
): Promise<{ token?: string }> {
  return apiRequest<{ token?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return apiRequest<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}