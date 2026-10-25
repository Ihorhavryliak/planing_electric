import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import {
  passwordResetTokens,
  sessions,
  users,
  type Database,
} from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export interface ActiveSession {
  session: SessionRow;
  user: UserRow;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listUsers(limit = 100): Promise<UserRow[]> {
    return this.db.select().from(users).limit(limit);
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async updateUserName(id: string, name: string): Promise<UserRow | null> {
    const [user] = await this.db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<UserRow> {
    const [user] = await this.db.insert(users).values(input).returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async createSession(input: CreateSessionInput): Promise<SessionRow> {
    const [session] = await this.db
      .insert(sessions)
      .values(input)
      .returning();

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  async findActiveSession(tokenHash: string): Promise<ActiveSession | null> {
    const [row] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async deleteExpiredSessions(now = new Date()): Promise<void> {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, now));
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(passwordResetTokens).values(input);
  }

  async findPasswordResetByHash(tokenHash: string) {
    const [row] = await this.db
      .select({ reset: passwordResetTokens, user: users })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async markPasswordResetUsed(id: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
