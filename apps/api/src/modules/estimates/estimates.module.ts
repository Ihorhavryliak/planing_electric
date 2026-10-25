import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';
import { DrawingModule } from '../drawing/drawing.module';
import { EditorModule } from '../editor/editor.module';
import { MaterialsModule } from '../materials/materials.module';
import { ProjectsModule } from '../projects/projects.module';
import { EstimatesController } from './estimates.controller';
import { EstimatesRepository } from './estimates.repository';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [
    ActivityLogModule,
    AuthModule,
    DrawingModule,
    EditorModule,
    MaterialsModule,
    ProjectsModule,
  ],
  providers: [EstimatesRepository, EstimatesService],
  controllers: [EstimatesController],
  exports: [EstimatesService, EstimatesRepository],
})
export class EstimatesModule {}
