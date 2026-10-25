import {
  Controller,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { PublicUser } from '@drawmyplace/contracts';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FloorsRepository } from './floors.repository';
import { PlansRepository } from './plans.repository';
import { ProjectsRepository } from '../projects/projects.repository';

@Controller('plans')
@UseGuards(AuthGuard)
export class PlanEventsController {
  constructor(
    @Inject(PlansRepository) private readonly plans: PlansRepository,
    @Inject(FloorsRepository) private readonly floors: FloorsRepository,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  @Sse(':planId/events')
  async events(
    @CurrentUser() user: PublicUser,
    @Param('planId', new ParseUUIDPipe({ version: '4' })) planId: string,
  ): Promise<Observable<MessageEvent>> {
    const plan = await this.plans.findById(planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    const floor = await this.floors.findById(plan.floorId);
    if (!floor) {
      throw new NotFoundException('Floor not found');
    }
    const project = await this.projects.findAccessibleById(floor.projectId, user.id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.realtime.stream(planId).pipe(
      map((event) => ({
        data: event,
        type: 'plan-update',
      })),
    );
  }
}