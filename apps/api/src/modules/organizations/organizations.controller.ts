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
  UseGuards,
} from '@nestjs/common';
import {
  addOrganizationMemberSchema,
  createOrganizationSchema,
  updateOrganizationMemberSchema,
  updateOrganizationSchema,
  type AddOrganizationMemberInput,
  type CreateOrganizationInput,
  type PublicOrganization,
  type PublicOrganizationMember,
  type PublicUser,
  type UpdateOrganizationInput,
  type UpdateOrganizationMemberInput,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService) private readonly orgs: OrganizationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: PublicUser): Promise<PublicOrganization[]> {
    return this.orgs.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(createOrganizationSchema))
    input: CreateOrganizationInput,
  ): Promise<PublicOrganization> {
    return this.orgs.create(user.id, input);
  }

  @Get(':id')
  get(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicOrganization | null> {
    return this.orgs.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    input: UpdateOrganizationInput,
  ): Promise<PublicOrganization | null> {
    return this.orgs.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.orgs.delete(user.id, id);
  }

  @Get(':id/members')
  members(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicOrganizationMember[] | null> {
    return this.orgs.listMembers(user.id, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(addOrganizationMemberSchema))
    input: AddOrganizationMemberInput,
  ): Promise<PublicOrganizationMember | null> {
    return this.orgs.addMember(user.id, id, input);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body(new ZodValidationPipe(updateOrganizationMemberSchema))
    input: UpdateOrganizationMemberInput,
  ): Promise<PublicOrganizationMember | null> {
    return this.orgs.updateMember(user.id, id, memberId, input);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ): Promise<void> {
    await this.orgs.removeMember(user.id, id, memberId);
  }
}