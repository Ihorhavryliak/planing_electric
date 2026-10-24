import type { PublicProject } from '@drawmyplace/contracts';
import type { ProjectRow } from './projects.repository';

export function toPublicProject(project: ProjectRow): PublicProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    revision: project.revision,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
