import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  ProjectStatus,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { projects, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

export type ProjectRow = typeof projects.$inferSelect;

@Injectable()
export class ProjectsRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listByOwner(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<ProjectRow[]> {
    const conditions: SQL[] = [eq(projects.createdBy, ownerId)];

    if (status !== 'all') {
      conditions.push(eq(projects.status, status));
    }

    return this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt));
  }

  async findOwnedById(
    projectId: string,
    ownerId: string,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.createdBy, ownerId)),
      )
      .limit(1);

    return project ?? null;
  }

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<ProjectRow> {
    const [project] = await this.db
      .insert(projects)
      .values({
        createdBy: ownerId,
        name: input.name,
        description: input.description ?? null,
      })
      .returning();

    if (!project) {
      throw new Error('Failed to create project');
    }

    return project;
  }

  async updateOwned(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRow | null> {
    const changes: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.description !== undefined) {
      changes.description = input.description;
    }

    const [project] = await this.db
      .update(projects)
      .set(changes)
      .where(
        and(eq(projects.id, projectId), eq(projects.createdBy, ownerId)),
      )
      .returning();

    return project ?? null;
  }

  async setStatusOwned(
    projectId: string,
    ownerId: string,
    status: ProjectStatus,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(projects.id, projectId), eq(projects.createdBy, ownerId)),
      )
      .returning();

    return project ?? null;
  }
}
