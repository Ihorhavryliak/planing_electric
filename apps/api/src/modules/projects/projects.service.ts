import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ProjectListQuery,
  PublicProject,
  PublicProjectMember,
  PublicProjectSummary,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import {
  toPublicProject,
  toPublicProjectSummary,
} from './projects.mapper';
import { ProjectsRepository, type ProjectRow } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly repository: ProjectsRepository,
    @Inject(ActivityLogService)
    private readonly activity: ActivityLogService,
    @Inject(NotificationsRepository)
    private readonly notifications: NotificationsRepository,
  ) {}

  async list(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<PublicProject[]> {
    const projects = await this.repository.listByOwner(ownerId, status);

    return projects.map(toPublicProject);
  }

  async listSummaries(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<PublicProjectSummary[]> {
    const rows = await this.repository.listSummariesByOwner(ownerId, status);

    return rows.map(toPublicProjectSummary);
  }

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<PublicProject> {
    const project = await this.repository.create(ownerId, input);

    await this.activity.record({
      projectId: project.id,
      actorId: ownerId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
    });

    return toPublicProject(project);
  }

  async get(ownerId: string, projectId: string): Promise<PublicProject> {
    const project = await this.repository.findAccessibleById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return toPublicProject(project);
  }

  async update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<PublicProject> {
    const existing = await this.repository.findOwnedById(projectId, ownerId);
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    if (
      input.expectedRevision !== undefined &&
      existing.revision !== input.expectedRevision
    ) {
      throw new ConflictException('Project revision mismatch');
    }

    const project = await this.repository.updateOwned(projectId, ownerId, input);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.activity.record({
      projectId: project.id,
      actorId: ownerId,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: project.id,
    });

    return toPublicProject(project);
  }

  async archive(ownerId: string, projectId: string): Promise<PublicProject> {
    return this.changeStatus(ownerId, projectId, 'archived');
  }

  async restore(ownerId: string, projectId: string): Promise<PublicProject> {
    return this.changeStatus(ownerId, projectId, 'active');
  }

  async listMembers(ownerId: string, projectId: string): Promise<PublicProjectMember[]> {
    await this.requireProjectManager(ownerId, projectId);
    const rows = await this.repository.listProjectMembers(projectId);
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      role: row.role as PublicProjectMember['role'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async addMember(
    ownerId: string,
    projectId: string,
    input: AddProjectMemberInput,
  ): Promise<PublicProjectMember> {
    await this.requireProjectManager(ownerId, projectId);
    const row = await this.repository.addProjectMember(
      projectId,
      input.userId,
      input.role,
    );
    if (!row) {
      throw new Error('Failed to add project member');
    }

    await this.notifications.create(input.userId, 'project.shared', {
      projectId,
      role: input.role,
    });

    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      role: row.role as PublicProjectMember['role'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async removeMember(ownerId: string, projectId: string, memberId: string) {
    await this.requireProjectManager(ownerId, projectId);
    await this.repository.removeProjectMember(memberId);
  }

  private async requireProjectManager(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const role = await this.repository.findAccessRole(projectId, userId);
    if (!role) {
      throw new NotFoundException('Project not found');
    }
    if (role !== 'owner' && role !== 'manager') {
      throw new ForbiddenException('Project manager access required');
    }
  }

  private async requireOwned(
    ownerId: string,
    projectId: string,
  ): Promise<ProjectRow> {
    const project = await this.repository.findOwnedById(projectId, ownerId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async changeStatus(
    ownerId: string,
    projectId: string,
    status: 'active' | 'archived',
  ): Promise<PublicProject> {
    const project = await this.repository.setStatusOwned(
      projectId,
      ownerId,
      status,
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.activity.record({
      projectId: project.id,
      actorId: ownerId,
      action: `project.${status}`,
      resourceType: 'project',
      resourceId: project.id,
    });

    return toPublicProject(project);
  }
}
