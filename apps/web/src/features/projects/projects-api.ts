import type {
  CreateProjectInput,
  PublicProject,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export type ProjectFilter = 'active' | 'archived' | 'all';

export function listProjects(
  status: ProjectFilter = 'active',
  signal?: AbortSignal,
): Promise<PublicProject[]> {
  const query = new URLSearchParams({ status });

  return apiRequest<PublicProject[]>(`/projects?${query.toString()}`, {
    signal,
  });
}

export function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<PublicProject> {
  return apiRequest<PublicProject>(`/projects/${projectId}`, { signal });
}

export function createProject(
  input: CreateProjectInput,
): Promise<PublicProject> {
  return apiRequest<PublicProject>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<PublicProject> {
  return apiRequest<PublicProject>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function archiveProject(projectId: string): Promise<PublicProject> {
  return apiRequest<PublicProject>(`/projects/${projectId}/archive`, {
    method: 'POST',
  });
}

export function restoreProject(projectId: string): Promise<PublicProject> {
  return apiRequest<PublicProject>(`/projects/${projectId}/restore`, {
    method: 'POST',
  });
}
