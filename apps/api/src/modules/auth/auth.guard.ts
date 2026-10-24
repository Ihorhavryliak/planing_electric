import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { toPublicUser } from './auth.mapper';
import { AuthRepository } from './auth.repository';
import type { AuthenticatedRequest } from './auth.types';
import { SESSION_COOKIE_NAME, SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const activeSession = await this.repository.findActiveSession(
      this.sessions.hashToken(token),
    );

    if (!activeSession || activeSession.user.status !== 'active') {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = toPublicUser(activeSession.user);
    request.sessionId = activeSession.session.id;

    await this.repository.touchSession(activeSession.session.id);

    return true;
  }

  private readToken(request: Request): string | undefined {
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }
}
