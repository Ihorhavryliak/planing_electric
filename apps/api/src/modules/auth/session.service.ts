import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE_NAME = 'dmp_session';

@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly secure: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const ttlDays = config.getOrThrow<number>('SESSION_TTL_DAYS');
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    this.secure = config.getOrThrow<string>('NODE_ENV') === 'production';
  }

  createToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  expiresAt(): Date {
    return new Date(Date.now() + this.ttlMs);
  }

  setCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.baseCookieOptions(),
      expires: expiresAt,
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.baseCookieOptions());
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
    };
  }
}
