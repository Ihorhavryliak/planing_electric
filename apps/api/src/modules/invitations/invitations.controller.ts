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
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  type AcceptInvitationInput,
  type CreateInvitationInput,
  type PublicUser,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InvitationsService } from './invitations.service';

@Controller()
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
  ) {}

  @Post('organizations/:organizationId/invitations')
  create(
    @CurrentUser() user: PublicUser,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Body(new ZodValidationPipe(createInvitationSchema))
    input: CreateInvitationInput,
  ) {
    return this.invitations.create(user.id, organizationId, input);
  }

  @Get('organizations/:organizationId/invitations')
  list(
    @CurrentUser() user: PublicUser,
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.invitations.list(user.id, organizationId);
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.invitations.revoke(user.id, id);
  }

  @Post('invitations/accept')
  accept(
    @CurrentUser() user: PublicUser,
    @Body(new ZodValidationPipe(acceptInvitationSchema))
    input: AcceptInvitationInput,
  ) {
    return this.invitations.accept(user.id, input.token);
  }
}