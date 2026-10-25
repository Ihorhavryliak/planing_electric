import type { PublicEstimate, PublicMaterial } from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listMaterials(): Promise<PublicMaterial[]> {
  return apiRequest<PublicMaterial[]>('/materials');
}

export function generateEstimate(planId: string): Promise<PublicEstimate> {
  return apiRequest<PublicEstimate>(`/plans/${planId}/estimate`, {
    method: 'POST',
  });
}

export function getEstimate(estimateId: string): Promise<PublicEstimate> {
  return apiRequest<PublicEstimate>(`/estimates/${estimateId}`);
}

export function updateEstimateStatus(
  estimateId: string,
  status: 'draft' | 'final',
): Promise<PublicEstimate> {
  return apiRequest<PublicEstimate>(`/estimates/${estimateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function listEstimatesByProject(
  projectId: string,
): Promise<PublicEstimate[]> {
  return apiRequest<PublicEstimate[]>(`/projects/${projectId}/estimates`);
}

export function updateEstimateItem(
  itemId: string,
  input: {
    quantity?: number;
    purchaseQuantity?: number | null;
    unitPrice?: number | null;
    note?: string | null;
    isOverridden?: boolean;
  },
): Promise<PublicEstimate> {
  return apiRequest<PublicEstimate>(`/estimate-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}