import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { EditorService } from './editor.service';
import { FloorsController } from './floors.controller';
import { FloorsRepository } from './floors.repository';
import { PlanStorageService } from './plan-storage.service';
import { PlansController } from './plans.controller';
import { PlansRepository } from './plans.repository';

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.getOrThrow<number>('MAX_UPLOAD_MB') * 1024 * 1024,
        },
      }),
    }),
  ],
  controllers: [FloorsController, PlansController],
  providers: [
    EditorService,
    FloorsRepository,
    PlansRepository,
    PlanStorageService,
  ],
})
export class EditorModule {}
