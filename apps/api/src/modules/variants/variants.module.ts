import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MaterialsModule } from '../materials/materials.module';
import { ProjectsModule } from '../projects/projects.module';
import { VariantsController } from './variants.controller';
import { VariantsRepository } from './variants.repository';
import { VariantsService } from './variants.service';

@Module({
  imports: [AuthModule, MaterialsModule, ProjectsModule],
  controllers: [VariantsController],
  providers: [VariantsRepository, VariantsService],
  exports: [VariantsService, VariantsRepository],
})
export class VariantsModule {}