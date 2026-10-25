import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EstimatesService } from './estimates.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateEstimateItemSchema,
  type UpdateEstimateItemInput,
} from '@drawmyplace/contracts';

const uuid = () => new ParseUUIDPipe({ version: '4' });

@Controller()
@UseGuards(AuthGuard)
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Post('plans/:planId/estimate')
  generate(
    @CurrentUser() user: { id: string },
    @Param('planId', uuid()) planId: string,
  ) {
    return this.estimates.generate(user.id, planId);
  }

  @Get('projects/:projectId/estimates')
  listByProject(
    @CurrentUser() user: { id: string },
    @Param('projectId', uuid()) projectId: string,
  ) {
    return this.estimates.listByProject(user.id, projectId);
  }

  @Get('estimates/:id')
  get(
    @CurrentUser() user: { id: string },
    @Param('id', uuid()) id: string,
  ) {
    return this.estimates.getById(user.id, id);
  }

  @Patch('estimate-items/:itemId')
  updateItem(
    @CurrentUser() user: { id: string },
    @Param('itemId', uuid()) itemId: string,
    @Body(new ZodValidationPipe(updateEstimateItemSchema))
    input: UpdateEstimateItemInput,
  ) {
    return this.estimates.updateItem(user.id, itemId, input);
  }

  @Get('estimates/:id/csv')
  async csv(
    @CurrentUser() user: { id: string },
    @Param('id', uuid()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const content = await this.estimates.toCsv(user.id, id);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="estimate-${id}.csv"`,
    );
    response.send(content);
  }

  @Get('estimates/:id/pdf')
  async pdf(
    @CurrentUser() user: { id: string },
    @Param('id', uuid()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.estimates.toPdf(user.id, id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="estimate-${id}.pdf"`,
    );
    response.send(buffer);
  }
}
