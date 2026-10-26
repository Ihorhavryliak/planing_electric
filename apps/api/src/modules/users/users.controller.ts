import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  DeleteAccountInput,
  OnboardingState,
  PublicUser,
  UpdateOnboardingInput,
  UpdateProfileInput,
} from '@drawmyplace/contracts';
import {
  deleteAccountSchema,
  updateOnboardingSchema,
  updateProfileSchema,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { AuthRepository } from '../auth/auth.repository';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { toPublicUser } from '../auth/auth.mapper';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }

  @Get('me/onboarding')
  @UseGuards(AuthGuard)
  onboarding(@CurrentUser() user: PublicUser): Promise<OnboardingState> {
    return this.users.getOnboarding(user.id);
  }

  @Patch('me/onboarding')
  @UseGuards(AuthGuard)
  updateOnboarding(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(updateOnboardingSchema))
    input: UpdateOnboardingInput,
  ): Promise<OnboardingState> {
    return this.users.updateOnboarding(user.id, input);
  }

  @Get('search')
  @UseGuards(AuthGuard)
  async search(@Query('email') email: string): Promise<PublicUser | null> {
    if (!email || email.length > 254) {
      return null;
    }
    const found = await this.authRepository.findUserByEmail(
      email.trim().toLowerCase(),
    );
    return found ? toPublicUser(found) : null;
  }

  @Get('me/export')
  @UseGuards(AuthGuard)
  async exportAccount(
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = await this.users.exportAccount(user.id);
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="drawmyplace-account.json"',
    );
    return data;
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async deleteAccount(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(deleteAccountSchema))
    input: DeleteAccountInput,
  ): Promise<void> {
    await this.auth.deleteAccount(user.id, input.password);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMe(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const updated = await this.authRepository.updateUserName(
      user.id,
      input.name,
    );
    if (!updated) {
      throw new Error('User not found');
    }
    return toPublicUser(updated);
  }
}