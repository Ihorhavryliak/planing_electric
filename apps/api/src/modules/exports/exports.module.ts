import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { ProjectsModule } from '../projects/projects.module';
import { ExportsController } from './exports.controller';

@Module({
  imports: [AuthModule, EstimatesModule, ProjectsModule],
  controllers: [ExportsController],
})
export class ExportsModule {}