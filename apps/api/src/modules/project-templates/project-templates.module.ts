import { Module } from '@nestjs/common';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectTemplatesRepository } from './project-templates.repository';
import { ProjectTemplatesService } from './project-templates.service';

@Module({
  controllers: [ProjectTemplatesController],
  providers: [ProjectTemplatesRepository, ProjectTemplatesService],
  exports: [ProjectTemplatesService],
})
export class ProjectTemplatesModule {}
