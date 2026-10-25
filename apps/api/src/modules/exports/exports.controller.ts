import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { PublicUser } from '@drawmyplace/contracts';
import { SignedLinksService } from '../../common/security/signed-links.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EstimatesRepository } from '../estimates/estimates.repository';
import { EstimatesService } from '../estimates/estimates.service';
import { ProjectsRepository } from '../projects/projects.repository';

const uuid = () => new ParseUUIDPipe({ version: '4' });

@Controller()
export class ExportsController {
  constructor(
    @Inject(SignedLinksService) private readonly links: SignedLinksService,
    @Inject(EstimatesService) private readonly estimates: EstimatesService,
    @Inject(EstimatesRepository)
    private readonly estimatesRepository: EstimatesRepository,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
  ) {}

  @Post('estimates/:id/export-links')
  @UseGuards(AuthGuard)
  async createLinks(
    @CurrentUser() user: PublicUser,
    @Param('id', uuid()) id: string,
  ) {
    const estimate = await this.estimates.getById(user.id, id);
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    const csvPath = `/exports/estimates/${id}/csv`;
    const pdfPath = `/exports/estimates/${id}/pdf`;
    const csv = this.links.create(csvPath);
    const pdf = this.links.create(pdfPath);

    return {
      csvUrl: `${csvPath}?expires=${csv.expires}&sig=${csv.sig}`,
      pdfUrl: `${pdfPath}?expires=${pdf.expires}&sig=${pdf.sig}`,
      expiresAt: new Date(csv.expires * 1000).toISOString(),
    };
  }

  @Get('exports/estimates/:id/csv')
  async csv(
    @Param('id', uuid()) id: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() response: Response,
  ): Promise<void> {
    const ownerId = await this.requireSigned(id, 'csv', expires, sig);
    const content = await this.estimates.toCsv(ownerId, id);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="estimate-${id}.csv"`,
    );
    response.send(content);
  }

  @Get('exports/estimates/:id/pdf')
  async pdf(
    @Param('id', uuid()) id: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() response: Response,
  ): Promise<void> {
    const ownerId = await this.requireSigned(id, 'pdf', expires, sig);
    const buffer = await this.estimates.toPdf(ownerId, id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="estimate-${id}.pdf"`,
    );
    response.send(buffer);
  }

  private async requireSigned(
    estimateId: string,
    format: 'csv' | 'pdf',
    expires: string,
    sig: string,
  ): Promise<string> {
    const path = `/exports/estimates/${estimateId}/${format}`;
    if (!this.links.verify(path, Number(expires), sig ?? '')) {
      throw new NotFoundException('Export link is invalid or expired');
    }

    const estimate = await this.estimatesRepository.findById(estimateId);
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    const project = await this.projects.findById(estimate.estimate.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project.createdBy;
  }
}