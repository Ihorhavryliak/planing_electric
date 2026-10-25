import { Inject, Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository)
    private readonly repo: NotificationsRepository,
  ) {}

  async list(userId: string) {
    const rows = await this.repo.listForUser(userId);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.markRead(id, userId);
    return row
      ? {
          id: row.id,
          userId: row.userId,
          type: row.type,
          payload: row.payload,
          readAt: row.readAt ? row.readAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }

  async markAllRead(userId: string) {
    await this.repo.markAllRead(userId);
  }
}