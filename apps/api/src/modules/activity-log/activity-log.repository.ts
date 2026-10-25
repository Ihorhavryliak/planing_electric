import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { activityLogs, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ActivityLogRepository {
  private readonly db: Database;
  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async create(data: {
    projectId?: string | null;
    actorId?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(activityLogs)
      .values({
        projectId: data.projectId ?? null,
        actorId: data.actorId ?? null,
        action: data.action,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
        metadata: data.metadata ?? {},
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string, limit = 50) {
    return this.db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.projectId, projectId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }
}