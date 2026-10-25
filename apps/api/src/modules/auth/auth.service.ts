import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import type {
  ForgotPasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  ResetPasswordInput,
} from '@drawmyplace/contracts';
import { MailService } from '../../common/mail/mail.service';
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
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
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

    await this.sendVerificationEmail(user);

    return this.issueSession(user, metadata);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = this.sessions.hashToken(token);
    const row = await this.repository.findEmailVerificationByHash(tokenHash);

    if (!row || row.token.usedAt || row.token.expiresAt < new Date()) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    await this.repository.markEmailVerified(row.user.id, row.token.id);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.emailVerifiedAt) {
      return;
    }
    await this.sendVerificationEmail(user);
  }

  private async sendVerificationEmail(user: UserRow): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.repository.createEmailVerificationToken({
      userId: user.id,
      tokenHash: this.sessions.hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? '';
    await this.mail.send(
      user.email,
      'Verify your DrawMyPlace email',
      `Confirm your email address within 24 hours:\n\n${webOrigin}/verify-email/${token}`,
    );
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

  /**
   * Always resolves, even for unknown emails, so the endpoint cannot be used
   * to enumerate accounts.
   */
  async forgotPassword(
    input: ForgotPasswordInput,
  ): Promise<{ token?: string }> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user || user.status !== 'active') {
      return {};
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.sessions.hashToken(token);
    await this.repository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? '';
    const link = `${webOrigin}/reset-password/${token}`;
    await this.mail.send(
      user.email,
      'Reset your DrawMyPlace password',
      `Use this link within one hour to reset your password:\n\n${link}\n\nIf you did not request this, ignore this email.`,
    );

    return this.config.get<string>('NODE_ENV') !== 'production'
      ? { token }
      : {};
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = this.sessions.hashToken(input.token);
    const row = await this.repository.findPasswordResetByHash(tokenHash);

    if (!row || row.reset.usedAt || row.reset.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const passwordHash = await this.passwords.hash(input.password);
    await this.repository.updateUserPassword(row.user.id, passwordHash);
    await this.repository.markPasswordResetUsed(row.reset.id);
    await this.repository.revokeAllSessions(row.user.id);
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
