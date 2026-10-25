import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { PublicMaterial, PublicUser } from '@drawmyplace/contracts';
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
}
