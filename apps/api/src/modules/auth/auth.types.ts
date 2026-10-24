import type { PublicUser } from '@drawmyplace/contracts';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
  sessionId: string;
  cookies: Record<string, string>;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}
