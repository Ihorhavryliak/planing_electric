import type {
  PublicProject,
  PublicProjectTemplate,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function listProjectTemplates(
  signal?: AbortSignal,
): Promise<PublicProjectTemplate[]> {
  return apiRequest<PublicProjectTemplate[]>('/project-templates', { signal });
}

export function createProjectFromTemplate(input: {
  templateCode: string;
  name?: string;
  description?: string;
}): Promise<PublicProject> {
  return apiRequest<PublicProject>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
