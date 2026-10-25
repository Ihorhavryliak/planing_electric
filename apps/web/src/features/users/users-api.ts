import type { PublicUser } from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function searchUserByEmail(email: string): Promise<PublicUser | null> {
  return apiRequest<PublicUser | null>(
    `/users/search?email=${encodeURIComponent(email)}`,
  );
}