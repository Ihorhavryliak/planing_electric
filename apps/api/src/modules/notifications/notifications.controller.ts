import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { PublicUser } from '@drawmyplace/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.notifications.list(user.id);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: PublicUser) {
    return this.notifications.markAllRead(user.id);
  }
}