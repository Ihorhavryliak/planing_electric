import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '@drawmyplace/contracts';
import type { AuthenticatedRequest } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().sessionId;
  },
);
