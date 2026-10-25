import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
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
  async get(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicOrganization> {
    const org = await this.orgs.get(user.id, id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    input: UpdateOrganizationInput,
  ): Promise<PublicOrganization> {
    const org = await this.orgs.update(user.id, id, input);
    if (!org) {
      throw new ForbiddenException('Not allowed to update this organization');
    }
    return org;
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
  async members(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicOrganizationMember[]> {
    const members = await this.orgs.listMembers(user.id, id);
    if (!members) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return members;
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(addOrganizationMemberSchema))
    input: AddOrganizationMemberInput,
  ): Promise<PublicOrganizationMember> {
    const member = await this.orgs.addMember(user.id, id, input);
    if (!member) {
      throw new ForbiddenException('Not allowed to manage members');
    }
    return member;
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body(new ZodValidationPipe(updateOrganizationMemberSchema))
    input: UpdateOrganizationMemberInput,
  ): Promise<PublicOrganizationMember> {
    const member = await this.orgs.updateMember(user.id, id, memberId, input);
    if (!member) {
      throw new ForbiddenException('Not allowed to manage members');
    }
    return member;
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