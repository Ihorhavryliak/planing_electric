import type {
  PublicProject,
  PublicProjectSummary,
} from '@drawmyplace/contracts';
import type {
  ProjectRow,
  ProjectSummaryRow,
} from './projects.repository';

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

export function toPublicProjectSummary(
  row: ProjectSummaryRow,
): PublicProjectSummary {
  return {
    ...toPublicProject(row.project),
    floorCount: row.floorCount,
    pointCount: row.pointCount,
    routeCount: row.routeCount,
    roomCount: row.roomCount,
    circuitCount: row.circuitCount,
    thumbnailSvg: row.thumbnailSvg,
  };
}
