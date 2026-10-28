import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { PublicProjectTemplate } from '@drawmyplace/contracts';
import { ProjectTemplatesService } from './project-templates.service';

/** Public read-only catalog; the plan payload is never exposed. */
@Controller('project-templates')
export class ProjectTemplatesController {
  constructor(
    @Inject(ProjectTemplatesService)
    private readonly templates: ProjectTemplatesService,
  ) {}

  @Get()
  list(): Promise<PublicProjectTemplate[]> {
    return this.templates.list();
  }

  @Get(':code')
  get(@Param('code') code: string): Promise<PublicProjectTemplate> {
    return this.templates.getByCode(code);
  }
}
