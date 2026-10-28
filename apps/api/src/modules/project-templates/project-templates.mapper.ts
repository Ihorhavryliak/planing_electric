import {
  publicProjectTemplateSchema,
  templatePlanPayloadSchema,
  type PublicProjectTemplate,
} from '@drawmyplace/contracts';
import type { ProjectTemplateRow } from './project-templates.repository';

export function toPublicProjectTemplate(
  row: ProjectTemplateRow,
): PublicProjectTemplate {
  const payload = templatePlanPayloadSchema.parse(row.planPayload);

  return publicProjectTemplateSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    previewSvg: row.previewSvg,
    roomsCount: payload.rooms.length,
    devicesCount: payload.points.length,
    circuitsCount: payload.calculationSettings?.circuits?.length ?? 0,
  });
}
