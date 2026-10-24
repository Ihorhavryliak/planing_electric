import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  PublicProject,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { toPublicProject } from './projects.mapper';
import { ProjectsRepository, type ProjectRow } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly repository: ProjectsRepository,
  ) {}

  async list(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<PublicProject[]> {
    const projects = await this.repository.listByOwner(ownerId, status);

    return projects.map(toPublicProject);
  }

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<PublicProject> {
    const project = await this.repository.create(ownerId, input);

    return toPublicProject(project);
  }

  async get(ownerId: string, projectId: string): Promise<PublicProject> {
    const project = await this.requireOwned(ownerId, projectId);

    return toPublicProject(project);
  }

  async update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<PublicProject> {
    const project = await this.repository.updateOwned(
      projectId,
      ownerId,
      input,
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return toPublicProject(project);
  }

  async archive(ownerId: string, projectId: string): Promise<PublicProject> {
    return this.changeStatus(ownerId, projectId, 'archived');
  }

  async restore(ownerId: string, projectId: string): Promise<PublicProject> {
    return this.changeStatus(ownerId, projectId, 'active');
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

    return toPublicProject(project);
  }
}
