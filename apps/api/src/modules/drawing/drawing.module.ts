import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EditorModule } from '../editor/editor.module';
import { ProjectsModule } from '../projects/projects.module';
import { DrawingController } from './drawing.controller';
import { DrawingRepository } from './drawing.repository';
import { DrawingService } from './drawing.service';

@Module({
  imports: [AuthModule, ProjectsModule, EditorModule],
  controllers: [DrawingController],
  providers: [DrawingRepository, DrawingService],
  exports: [DrawingService, DrawingRepository],
})
export class DrawingModule {}
