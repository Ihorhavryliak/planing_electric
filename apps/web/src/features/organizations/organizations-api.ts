import type {
  CreateOrganizationInput,
  PublicOrganization,
  PublicOrganizationMember,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listOrganizations(): Promise<PublicOrganization[]> {
  return apiRequest<PublicOrganization[]>('/organizations');
}

export function createOrganization(
  input: CreateOrganizationInput,
): Promise<PublicOrganization> {
  return apiRequest<PublicOrganization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getOrganization(id: string): Promise<PublicOrganization | null> {
  return apiRequest<PublicOrganization | null>(`/organizations/${id}`);
}

export function listOrganizationMembers(
  id: string,
): Promise<PublicOrganizationMember[] | null> {
  return apiRequest<PublicOrganizationMember[] | null>(
    `/organizations/${id}/members`,
  );
}