import type {
  CreateFloorInput,
  PublicFloor,
  PublicPlan,
  UpdatePlanInput,
} from '@drawmyplace/contracts';
import { apiFetch, apiRequest } from '@/lib/api';

export function listFloors(
  projectId: string,
  signal?: AbortSignal,
): Promise<PublicFloor[]> {
  return apiRequest<PublicFloor[]>(`/projects/${projectId}/floors`, { signal });
}

export function createFloor(
  projectId: string,
  input: CreateFloorInput,
): Promise<PublicFloor> {
  return apiRequest<PublicFloor>(`/projects/${projectId}/floors`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createBlankPlan(floorId: string): Promise<PublicPlan> {
  return apiRequest<PublicPlan>(`/floors/${floorId}/plans`, {
    method: 'POST',
  });
}

export function uploadPlanFile(
  floorId: string,
  file: File,
  page?: number,
): Promise<PublicPlan> {
  const body = new FormData();
  body.set('file', file);

  if (page !== undefined) {
    body.set('page', String(page));
  }

  return apiRequest<PublicPlan>(`/floors/${floorId}/plans/upload`, {
    method: 'POST',
    body,
  });
}

export function updatePlan(
  planId: string,
  input: UpdatePlanInput,
): Promise<PublicPlan> {
  return apiRequest<PublicPlan>(`/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function replacePlanFile(
  planId: string,
  file: File,
  page?: number,
): Promise<PublicPlan> {
  const body = new FormData();
  body.set('file', file);

  if (page !== undefined) {
    body.set('page', String(page));
  }

  return apiRequest<PublicPlan>(`/plans/${planId}/file`, {
    method: 'POST',
    body,
  });
}

export async function uploadPlanPreview(
  planId: string,
  preview: Blob,
): Promise<PublicPlan> {
  const body = new FormData();
  body.set('file', preview, 'preview.png');

  return apiRequest<PublicPlan>(`/plans/${planId}/preview`, {
    method: 'POST',
    body,
  });
}

export async function loadPlanFile(planId: string): Promise<Blob> {
  const response = await apiFetch(`/plans/${planId}/file`, {
    cache: 'no-store',
  });

  return response.blob();
}

export function planFileUrl(planId: string, nonce: number): string {
  return `/api/v1/plans/${planId}/file?v=${nonce}`;
}

export function planPreviewUrl(planId: string, nonce: number): string {
  return `/api/v1/plans/${planId}/preview?v=${nonce}`;
}
