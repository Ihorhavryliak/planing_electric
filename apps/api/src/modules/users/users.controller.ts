import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicUser } from '@drawmyplace/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
