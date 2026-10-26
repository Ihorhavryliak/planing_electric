import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { LocalStorageDriver } from '../../common/storage/local-storage-driver';
import { S3StorageDriver } from '../../common/storage/s3-storage-driver';
import { STORAGE_DRIVER } from '../../common/storage/storage-driver';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { EditorService } from './editor.service';
import { FloorsController } from './floors.controller';
import { FloorsRepository } from './floors.repository';
import { PlanEventsController } from './plan-events.controller';
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
  controllers: [FloorsController, PlansController, PlanEventsController],
  providers: [
    EditorService,
    FloorsRepository,
    PlansRepository,
    PlanStorageService,
    LocalStorageDriver,
    S3StorageDriver,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService, LocalStorageDriver, S3StorageDriver],
      useFactory: (
        config: ConfigService,
        local: LocalStorageDriver,
        s3: S3StorageDriver,
      ) => (config.get<string>('STORAGE_DRIVER') === 's3' ? s3 : local),
    },
  ],
  exports: [FloorsRepository, PlansRepository, PlanStorageService],
})

export class EditorModule {}
