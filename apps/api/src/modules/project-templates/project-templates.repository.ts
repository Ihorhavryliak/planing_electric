import { Inject, Injectable } from '@nestjs/common';
import {
  projectTemplates,
  type Database,
} from '@drawmyplace/database';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';

export type ProjectTemplateRow = typeof projectTemplates.$inferSelect;

@Injectable()
export class ProjectTemplatesRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listPublic(): Promise<ProjectTemplateRow[]> {
    return this.db
      .select()
      .from(projectTemplates)
      .where(eq(projectTemplates.isPublic, true))
      .orderBy(asc(projectTemplates.sortOrder), asc(projectTemplates.code));
  }

  async findPublicByCode(
    code: string,
  ): Promise<ProjectTemplateRow | null> {
    const [row] = await this.db
      .select()
      .from(projectTemplates)
      .where(
        and(
          eq(projectTemplates.code, code),
          eq(projectTemplates.isPublic, true),
        ),
      )
      .limit(1);

    return row ?? null;
  }
}
