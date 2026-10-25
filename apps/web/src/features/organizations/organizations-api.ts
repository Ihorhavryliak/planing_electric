import type {
  CreateInvitationInput,
  CreateOrganizationInput,
  PublicInvitation,
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

export function createInvitation(
  organizationId: string,
  input: CreateInvitationInput,
): Promise<{ invitation: PublicInvitation; token?: string }> {
  return apiRequest<{ invitation: PublicInvitation; token?: string }>(
    `/organizations/${organizationId}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function listInvitations(
  organizationId: string,
): Promise<PublicInvitation[] | null> {
  return apiRequest<PublicInvitation[] | null>(
    `/organizations/${organizationId}/invitations`,
  );
}

export function revokeInvitation(invitationId: string): Promise<void> {
  return apiRequest<void>(`/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

export function acceptInvitation(token: string): Promise<PublicInvitation | null> {
  return apiRequest<PublicInvitation | null>('/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}