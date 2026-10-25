import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  ProjectStatus,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { projectMembers, projects, type Database } from '@drawmyplace/database';
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
    const conditions: SQL[] = [
      or(
        eq(projects.createdBy, ownerId),
        sql`exists (select 1 from project_members pm where pm.project_id = ${projects.id} and pm.user_id = ${ownerId})`,
      ) as SQL,
    ];

    if (status !== 'all') {
      conditions.push(eq(projects.status, status));
    }

    return this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt));
  }

  async findById(projectId: string): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return project ?? null;
  }

  async findAccessRole(
    projectId: string,
    userId: string,
  ): Promise<'owner' | 'manager' | 'electrician' | 'viewer' | null> {
    const project = await this.findOwnedById(projectId, userId);
    if (project) {
      return 'owner';
    }
    const member = await this.findProjectMember(projectId, userId);
    return (member?.role as 'manager' | 'electrician' | 'viewer' | undefined) ?? null;
  }

  async findAccessibleById(
    projectId: string,
    userId: string,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          or(
            eq(projects.createdBy, userId),
            sql`exists (select 1 from project_members pm where pm.project_id = ${projects.id} and pm.user_id = ${userId})`,
          ),
        ),
      )
      .limit(1);

    return project ?? null;
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
        organizationId: input.organizationId ?? null,
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
      revision: (await this.currentRevision(projectId, ownerId)) + 1,
    };

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.description !== undefined) {
      changes.description = input.description;
    }

    const conditions = [
      eq(projects.id, projectId),
      eq(projects.createdBy, ownerId),
    ];

    if (input.expectedRevision !== undefined) {
      conditions.push(eq(projects.revision, input.expectedRevision));
    }

    const [project] = await this.db
      .update(projects)
      .set(changes)
      .where(and(...conditions))
      .returning();

    return project ?? null;
  }

  private async currentRevision(projectId: string, ownerId: string): Promise<number> {
    const row = await this.findOwnedById(projectId, ownerId);
    return row?.revision ?? 0;
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

  async listProjectMembers(projectId: string) {
    return this.db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
  }

  async findProjectMember(projectId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async addProjectMember(
    projectId: string,
    userId: string,
    role: string,
  ) {
    const [row] = await this.db
      .insert(projectMembers)
      .values({ projectId, userId, role: role as never })
      .returning();
    return row;
  }

  async updateProjectMember(memberId: string, role: string) {
    const [row] = await this.db
      .update(projectMembers)
      .set({ role: role as never })
      .where(eq(projectMembers.id, memberId))
      .returning();
    return row ?? null;
  }

  async removeProjectMember(memberId: string) {
    await this.db.delete(projectMembers).where(eq(projectMembers.id, memberId));
  }
}
