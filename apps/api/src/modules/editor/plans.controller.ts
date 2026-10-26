import { Readable } from 'node:stream';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  updatePlanSchema,
  type PublicPlan,
  type PublicUser,
  type UpdatePlanInput,
} from '@drawmyplace/contracts';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EditorService } from './editor.service';

@Controller()
@UseGuards(AuthGuard)
export class PlansController {
  constructor(@Inject(EditorService) private readonly editor: EditorService) {}

  @Post('floors/:floorId/plans')
  createBlank(
    @CurrentUser() user: PublicUser,
    @Param('floorId', new ParseUUIDPipe({ version: '4' })) floorId: string,
  ): Promise<PublicPlan> {
    return this.editor.createBlankPlan(user.id, floorId);
  }

  @Post('floors/:floorId/plans/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: PublicUser,
    @Param('floorId', new ParseUUIDPipe({ version: '4' })) floorId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('page') page?: string,
  ): Promise<PublicPlan> {
    return this.editor.uploadPlan(user.id, floorId, file, page);
  }

  @Get('plans/:id')
  get(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicPlan> {
    return this.editor.getPlan(user.id, id);
  }

  @Patch('plans/:id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) input: UpdatePlanInput,
  ): Promise<PublicPlan> {
    return this.editor.updatePlan(user.id, id, input);
  }

  @Post('plans/:id/file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  replaceFile(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('page') page?: string,
  ): Promise<PublicPlan> {
    return this.editor.replacePlanFile(user.id, id, file, page);
  }

  @Post('plans/:id/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  uploadPreview(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PublicPlan> {
    return this.editor.uploadPreview(user.id, id, file);
  }

  @Get('plans/:id/file')
  async file(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.editor.getFileContent(user.id, id);

    response.set({
      'Content-Type': content.mimeType,
      'Content-Length': String(content.size),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(Readable.from(content.data));
  }

  @Get('plans/:id/preview')
  async preview(
    @CurrentUser() user: PublicUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const content = await this.editor.getPreviewContent(user.id, id);

    response.set({
      'Content-Type': content.mimeType,
      'Content-Length': String(content.size),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(Readable.from(content.data));
  }
}
