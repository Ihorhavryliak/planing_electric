import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateMaterialInput,
  PublicMaterial,
  PublicUser,
  UpdateMaterialInput,
} from '@drawmyplace/contracts';
import { createMaterialSchema, updateMaterialSchema } from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MaterialsService } from './materials.service';

@Controller('materials')
@UseGuards(AuthGuard)
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  list(@CurrentUser() _user: PublicUser): Promise<PublicMaterial[]> {
    return this.materials.list();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PublicMaterial | null> {
    return this.materials.getById(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createMaterialSchema)) input: CreateMaterialInput,
  ): Promise<PublicMaterial> {
    return this.materials.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updateMaterialSchema)) input: UpdateMaterialInput,
  ): Promise<PublicMaterial | null> {
    return this.materials.update(id, input);
  }
}
