import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  addProjectMemberSchema,
  createProjectSchema,
  projectListQuerySchema,
  updateProjectSchema,
  type AddProjectMemberInput,
  type CreateProjectInput,
  type ProjectListQuery,
  type PublicProject,
  type PublicProjectMember,
  type PublicUser,
  type UpdateProjectInput,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: PublicUser,
    @Query(new ZodValidationPipe(projectListQuerySchema))
    query: ProjectListQuery,
  ): Promise<PublicProject[]> {
    return this.projects.list(user.id, query.status);
  }

  @Post()
  create(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(createProjectSchema)) input: CreateProjectInput,
  ): Promise<PublicProject> {
    return this.projects.create(user.id, input);
  }

  @Get(':id')
  get(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicProject> {
    return this.projects.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) input: UpdateProjectInput,
  ): Promise<PublicProject> {
    return this.projects.update(user.id, id, input);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicProject> {
    return this.projects.archive(user.id, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicProject> {
    return this.projects.restore(user.id, id);
  }

  @Get(':id/members')
  listMembers(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicProjectMember[]> {
    return this.projects.listMembers(user.id, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema))
    input: AddProjectMemberInput,
  ): Promise<PublicProjectMember> {
    return this.projects.addMember(user.id, id, input);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ): Promise<void> {
    await this.projects.removeMember(user.id, id, memberId);
  }
}
