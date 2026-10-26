import type { PublicVariant, UpdateVariantInput } from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listVariants(projectId: string): Promise<PublicVariant[]> {
  return apiRequest<PublicVariant[]>(`/projects/${projectId}/variants`);
}

export function createVariant(
  projectId: string,
  name: string,
): Promise<PublicVariant> {
  return apiRequest<PublicVariant>(`/projects/${projectId}/variants`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateVariant(
  id: string,
  input: UpdateVariantInput,
): Promise<PublicVariant> {
  return apiRequest<PublicVariant>(`/variants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function duplicateVariant(id: string): Promise<PublicVariant> {
  return apiRequest<PublicVariant>(`/variants/${id}/duplicate`, {
    method: 'POST',
  });
}