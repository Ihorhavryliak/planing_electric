import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  templatePlanPayloadSchema,
  type PublicProjectTemplate,
  type TemplatePlanPayload,
} from '@drawmyplace/contracts';
import { toPublicProjectTemplate } from './project-templates.mapper';
import { ProjectTemplatesRepository } from './project-templates.repository';

export interface TemplateForCreation {
  name: Record<string, string>;
  payload: TemplatePlanPayload;
}

@Injectable()
export class ProjectTemplatesService {
  constructor(
    @Inject(ProjectTemplatesRepository)
    private readonly repository: ProjectTemplatesRepository,
  ) {}

  async list(): Promise<PublicProjectTemplate[]> {
    const rows = await this.repository.listPublic();

    return rows.map(toPublicProjectTemplate);
  }

  async getByCode(code: string): Promise<PublicProjectTemplate> {
    const row = await this.repository.findPublicByCode(code);

    if (!row) {
      throw new NotFoundException('Project template not found');
    }

    return toPublicProjectTemplate(row);
  }

  /** Validated payload for project creation; null for an unknown/private code. */
  async findForCreation(code: string): Promise<TemplateForCreation | null> {
    const row = await this.repository.findPublicByCode(code);

    if (!row) return null;

    return {
      name: row.name,
      payload: templatePlanPayloadSchema.parse(row.planPayload),
    };
  }
}
