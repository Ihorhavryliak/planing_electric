import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { projectVariants, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class VariantsRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(projectVariants)
      .where(eq(projectVariants.projectId, projectId))
      .orderBy(asc(projectVariants.createdAt));
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(projectVariants)
      .where(eq(projectVariants.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByName(projectId: string, name: string) {
    const [row] = await this.db
      .select()
      .from(projectVariants)
      .where(
        and(
          eq(projectVariants.projectId, projectId),
          eq(projectVariants.name, name),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    projectId: string;
    name: string;
    data: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(projectVariants)
      .values(input)
      .returning();
    return row ?? null;
  }

  async update(
    id: string,
    input: { name?: string; status?: 'active' | 'archived' },
  ) {
    const [row] = await this.db
      .update(projectVariants)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(projectVariants.id, id))
      .returning();
    return row ?? null;
  }
}