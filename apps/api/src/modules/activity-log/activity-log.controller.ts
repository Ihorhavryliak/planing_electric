import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { PublicUser } from '@drawmyplace/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActivityLogService } from './activity-log.service';

@Controller()
@UseGuards(AuthGuard)
export class ActivityLogController {
  constructor(
    @Inject(ActivityLogService) private readonly activity: ActivityLogService,
  ) {}

  @Get('projects/:projectId/activity')
  list(
    @CurrentUser() user: PublicUser,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.activity.listForProject(user.id, projectId);
  }
}