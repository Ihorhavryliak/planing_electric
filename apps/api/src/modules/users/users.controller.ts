import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { PublicUser, UpdateProfileInput } from '@drawmyplace/contracts';
import { updateProfileSchema } from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { AuthRepository } from '../auth/auth.repository';
import { CurrentUser } from '../auth/current-user.decorator';
import { toPublicUser } from '../auth/auth.mapper';

@Controller('users')
export class UsersController {
  constructor(private readonly authRepository: AuthRepository) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMe(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const updated = await this.authRepository.updateUserName(user.id, input.name);
    if (!updated) {
      throw new Error('User not found');
    }
    return toPublicUser(updated);
  }
}