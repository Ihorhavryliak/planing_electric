import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@drawmyplace/contracts';
import type { SessionMetadata } from './auth.types';
import { AuthRepository, type UserRow } from './auth.repository';
import { toPublicUser } from './auth.mapper';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$o/nOywjz2poc9wga73zFdQ$MLbeg3crs1HlvcURVbymYL77XyyF7J3mBfuU+Wiz8NY';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export interface IssuedSession {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };

  return (
    candidate.code === '23505' ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('duplicate key'))
  );
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async register(
    input: RegisterInput,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const existing = await this.repository.findUserByEmail(input.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwords.hash(input.password);

    let user: UserRow;

    try {
      user = await this.repository.createUser({
        email: input.email,
        name: input.name,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }

    return this.issueSession(user, metadata);
  }

  async login(
    input: LoginInput,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const user = await this.repository.findUserByEmail(input.email);
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwords.verify(
      passwordHash,
      input.password,
    );

    if (!user || !passwordMatches || user.status !== 'active') {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueSession(user, metadata);
  }

  async logout(token: string): Promise<void> {
    await this.repository.revokeSessionByTokenHash(
      this.sessions.hashToken(token),
    );
  }

  private async issueSession(
    user: UserRow,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const token = this.sessions.createToken();
    const expiresAt = this.sessions.expiresAt();

    await this.repository.createSession({
      userId: user.id,
      tokenHash: this.sessions.hashToken(token),
      expiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });

    return {
      user: toPublicUser(user),
      token,
      expiresAt,
    };
  }
}
