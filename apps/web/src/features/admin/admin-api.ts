import type { PublicOrganization, PublicUser } from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listAdminUsers(): Promise<PublicUser[]> {
  return apiRequest<PublicUser[]>('/admin/users');
}

export function listAdminOrganizations(): Promise<PublicOrganization[]> {
  return apiRequest<PublicOrganization[]>('/admin/organizations');
}