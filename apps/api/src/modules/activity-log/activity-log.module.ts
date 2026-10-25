import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogRepository } from './activity-log.repository';
import { ActivityLogService } from './activity-log.service';

@Module({
  imports: [AuthModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogRepository, ActivityLogService],
  exports: [ActivityLogRepository, ActivityLogService],
})
export class ActivityLogModule {}