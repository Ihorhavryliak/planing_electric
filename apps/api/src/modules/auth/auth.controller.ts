import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME, SessionService } from './session.service';
import type { SessionMetadata } from './auth.types';
import type { Request, Response } from 'express';

function metadataFrom(request: Request): SessionMetadata {
  return {
    userAgent: request.get('user-agent') ?? undefined,
    ipAddress: request.ip ?? undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessionCookies: SessionService,
  ) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.register(input, metadataFrom(request));
    this.sessionCookies.setCookie(response, result.token, result.expiresAt);

    return result.user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.login(input, metadataFrom(request));
    this.sessionCookies.setCookie(response, result.token, result.expiresAt);

    return result.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token === 'string' && token.length > 0) {
      await this.auth.logout(token);
    }

    this.sessionCookies.clearCookie(response);
  }
}
