import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createVariantSchema,
  updateVariantSchema,
  type CreateVariantInput,
  type PublicUser,
  type UpdateVariantInput,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VariantsService } from './variants.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });

@Controller()
@UseGuards(AuthGuard)
export class VariantsController {
  constructor(@Inject(VariantsService) private readonly variants: VariantsService) {}

  @Get('projects/:projectId/variants')
  async list(
    @CurrentUser() user: PublicUser,
    @Param('projectId', uuid()) projectId: string,
  ) {
    const variants = await this.variants.list(user.id, projectId);
    if (!variants) {
      throw new ForbiddenException('Project manager access required');
    }
    return variants;
  }

  @Post('projects/:projectId/variants')
  async create(
    @CurrentUser() user: PublicUser,
    @Param('projectId', uuid()) projectId: string,
    @Body(new ZodValidationPipe(createVariantSchema))
    input: CreateVariantInput,
  ) {
    const variant = await this.variants.create(user.id, projectId, input.name);
    if (!variant) {
      throw new ForbiddenException(
        'Project manager access required or the name is already used',
      );
    }
    return variant;
  }

  @Patch('variants/:id')
  async update(
    @CurrentUser() user: PublicUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateVariantSchema))
    input: UpdateVariantInput,
  ) {
    const variant = await this.variants.update(user.id, id, input);
    if (!variant) {
      throw new NotFoundException(
        'Variant not found, name already used, or access denied',
      );
    }
    return variant;
  }

  @Post('variants/:id/duplicate')
  async duplicate(
    @CurrentUser() user: PublicUser,
    @Param('id', uuid()) id: string,
  ) {
    const variant = await this.variants.duplicate(user.id, id);
    if (!variant) {
      throw new NotFoundException('Variant not found or access denied');
    }
    return variant;
  }
}