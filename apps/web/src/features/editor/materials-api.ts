import type {
  EstimateType,
  PublicEstimate,
  PublicMaterial,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listMaterials(): Promise<PublicMaterial[]> {
  return apiRequest<PublicMaterial[]>('/materials');
}

export function createMaterial(input: {
  code: string;
  name: string;
  unit: string;
  category?: 'cable' | 'conduit' | 'accessory' | 'other' | null;
  unitPrice?: number | null;
  organizationId?: string | null;
}): Promise<PublicMaterial> {
  return apiRequest<PublicMaterial>('/materials', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMaterial(
  id: string,
  input: {
    name?: string;
    unit?: string;
    category?: 'cable' | 'conduit' | 'accessory' | 'other' | null;
    unitPrice?: number | null;
    active?: boolean;
  },
): Promise<PublicMaterial | null> {
  return apiRequest<PublicMaterial | null>(`/materials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createExportLinks(
  estimateId: string,
): Promise<{ csvUrl: string; pdfUrl: string; expiresAt: string }> {
  return apiRequest<{ csvUrl: string; pdfUrl: string; expiresAt: string }>(
    `/estimates/${estimateId}/export-links`,
    { method: 'POST' },
  );
}

export function generateEstimate(
  planId: string,
  type: EstimateType = 'power',
): Promise<PublicEstimate> {
  const query = type === 'power' ? '' : `?type=${type}`;

  return apiRequest<PublicEstimate>(`/plans/${planId}/estimate${query}`, {
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

export function listAllEstimates(): Promise<PublicEstimate[]> {
  return apiRequest<PublicEstimate[]>('/estimates');
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