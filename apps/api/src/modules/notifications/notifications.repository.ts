import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { notifications, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsRepository {
  private readonly db: Database;
  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async create(userId: string, type: string, payload: Record<string, unknown> = {}) {
    const [row] = await this.db
      .insert(notifications)
      .values({ userId, type, payload })
      .returning();
    return row;
  }

  async listForUser(userId: string, limit = 50) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markRead(id: string, userId: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return row ?? null;
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
}