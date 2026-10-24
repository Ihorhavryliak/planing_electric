import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createFloorSchema,
  type CreateFloorInput,
  type PublicFloor,
  type PublicUser,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EditorService } from './editor.service';

@Controller('projects/:projectId/floors')
@UseGuards(AuthGuard)
export class FloorsController {
  constructor(@Inject(EditorService) private readonly editor: EditorService) {}

  @Get()
  list(
    @CurrentUser() user: PublicUser,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<PublicFloor[]> {
    return this.editor.listFloors(user.id, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: PublicUser,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body(new ZodValidationPipe(createFloorSchema)) input: CreateFloorInput,
  ): Promise<PublicFloor> {
    return this.editor.createFloor(user.id, projectId, input);
  }
}
