import { Inject, Injectable } from '@nestjs/common';
import { ActivityLogRepository } from './activity-log.repository';

@Injectable()
export class ActivityLogService {
  constructor(
    @Inject(ActivityLogRepository)
    private readonly repo: ActivityLogRepository,
  ) {}

  async record(input: {
    projectId?: string | null;
    actorId?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.repo.create(input);
  }

  async listForProject(userId: string, projectId: string) {
    // ownership not enforced here; controller/service callers should check
    return this.repo.listByProject(projectId);
  }
}