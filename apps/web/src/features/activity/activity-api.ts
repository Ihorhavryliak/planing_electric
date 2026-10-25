import { apiRequest } from '@/lib/api';

export interface ActivityLogEntry {
  id: string;
  projectId: string | null;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function listActivity(projectId: string): Promise<ActivityLogEntry[]> {
  return apiRequest<ActivityLogEntry[]>(`/projects/${projectId}/activity`);
}