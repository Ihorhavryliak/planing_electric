import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type {
  CreateFloorInput,
  PublicFloor,
  PublicPlan,
  UpdatePlanInput,
} from '@drawmyplace/contracts';
import { ProjectsRepository } from '../projects/projects.repository';
import { toPublicFloor, toPublicPlan } from './editor.mapper';
import { FloorsRepository, type FloorRow } from './floors.repository';
import { PlanStorageService, type StoredFileInfo } from './plan-storage.service';
import { PlansRepository, type PlanRow } from './plans.repository';

interface UploadedPlanFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const planMimeTypes = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['application/pdf', 'pdf'],
]);

@Injectable()
export class EditorService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly projects: ProjectsRepository,
    @Inject(FloorsRepository) private readonly floors: FloorsRepository,
    @Inject(PlansRepository) private readonly plans: PlansRepository,
    @Inject(PlanStorageService) private readonly storage: PlanStorageService,
  ) {}

  async listFloors(
    ownerId: string,
    projectId: string,
  ): Promise<PublicFloor[]> {
    await this.requireOwnedProject(ownerId, projectId);

    const floors = await this.floors.listByProject(projectId);
    const plans = await this.plans.listByFloorIds(
      floors.map((floor) => floor.id),
    );
    const firstPlanByFloor = new Map<string, PlanRow>();

    for (const plan of plans) {
      if (!firstPlanByFloor.has(plan.floorId)) {
        firstPlanByFloor.set(plan.floorId, plan);
      }
    }

    return floors.map((floor) =>
      toPublicFloor(floor, firstPlanByFloor.get(floor.id) ?? null),
    );
  }

  async createFloor(
    ownerId: string,
    projectId: string,
    input: CreateFloorInput,
  ): Promise<PublicFloor> {
    await this.requireOwnedProject(ownerId, projectId);

    const floor = await this.floors.create(projectId, input.name);

    return toPublicFloor(floor, null);
  }

  async createBlankPlan(
    ownerId: string,
    floorId: string,
  ): Promise<PublicPlan> {
    const floor = await this.requireOwnedFloor(ownerId, floorId);
    await this.ensureFloorHasNoPlan(floor.id);

    const plan = await this.plans.create(floor.id, { sourceType: 'blank' });

    return toPublicPlan(plan);
  }

  async uploadPlan(
    ownerId: string,
    floorId: string,
    file: UploadedPlanFile | undefined,
    page: string | undefined,
  ): Promise<PublicPlan> {
    const floor = await this.requireOwnedFloor(ownerId, floorId);
    await this.ensureFloorHasNoPlan(floor.id);

    const { extension, file: planFile } = this.validatePlanFile(file);
    const pageNumber = this.parsePdfPage(planFile.mimetype, page);
    const fileKey = await this.storage.save(planFile.buffer, extension);

    try {
      const plan = await this.plans.create(floor.id, {
        sourceType: 'upload',
        fileKey,
        mimeType: planFile.mimetype,
        page: pageNumber,
      });

      return toPublicPlan(plan);
    } catch (error) {
      await this.storage.remove(fileKey);
      throw error;
    }
  }

  async getPlan(ownerId: string, planId: string): Promise<PublicPlan> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    return toPublicPlan(plan);
  }

  async updatePlan(
    ownerId: string,
    planId: string,
    input: UpdatePlanInput,
  ): Promise<PublicPlan> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if (
      input.expectedVersion !== undefined &&
      plan.version !== input.expectedVersion
    ) {
      throw new ConflictException('Plan version mismatch');
    }

    if (input.page !== undefined && plan.mimeType !== 'application/pdf') {
      throw new BadRequestException(
        'Page selection is only available for PDF plans',
      );
    }

    const pageChanged =
      input.page !== undefined && input.page !== plan.page;
    const updated = await this.plans.update(
      plan.id,
      input,
      pageChanged && plan.mimeType === 'application/pdf',
    );

    if (pageChanged && plan.mimeType === 'application/pdf') {
      await this.storage.remove(plan.previewKey);
    }

    return toPublicPlan(updated);
  }

  async replacePlanFile(
    ownerId: string,
    planId: string,
    file: UploadedPlanFile | undefined,
    page: string | undefined,
  ): Promise<PublicPlan> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    const { extension, file: planFile } = this.validatePlanFile(file);
    const pageNumber = this.parsePdfPage(planFile.mimetype, page);
    const fileKey = await this.storage.save(planFile.buffer, extension);

    let updated: PlanRow;

    try {
      updated = await this.plans.replaceFile(plan.id, {
        fileKey,
        mimeType: planFile.mimetype,
        page: pageNumber,
      });
    } catch (error) {
      await this.storage.remove(fileKey);
      throw error;
    }

    await Promise.all([
      this.storage.remove(plan.fileKey),
      this.storage.remove(plan.previewKey),
    ]);

    return toPublicPlan(updated);
  }

  async uploadPreview(
    ownerId: string,
    planId: string,
    file: UploadedPlanFile | undefined,
  ): Promise<PublicPlan> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if (!file) {
      throw new BadRequestException('Preview file is required');
    }

    if (file.size === 0) {
      throw new BadRequestException('Preview file is empty');
    }

    if (file.size > this.storage.maxUploadBytes) {
      throw new PayloadTooLargeException('Preview file is too large');
    }

    if (file.mimetype !== 'image/png') {
      throw new BadRequestException('Preview must be a PNG image');
    }

    const previewKey = await this.storage.save(file.buffer, 'png');

    try {
      const updated = await this.plans.setPreview(plan.id, previewKey);
      await this.storage.remove(plan.previewKey);

      return toPublicPlan(updated);
    } catch (error) {
      await this.storage.remove(previewKey);
      throw error;
    }
  }

  async getFileContent(
    ownerId: string,
    planId: string,
  ): Promise<StoredFileInfo> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if (!plan.fileKey || !plan.mimeType) {
      throw new NotFoundException('This plan has no uploaded file');
    }

    const file = await this.storage.getInfo(plan.fileKey, plan.mimeType);

    if (!file) {
      throw new NotFoundException('Plan file was not found in storage');
    }

    return file;
  }

  async getPreviewContent(
    ownerId: string,
    planId: string,
  ): Promise<StoredFileInfo> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if (!plan.previewKey) {
      throw new NotFoundException('This plan has no preview yet');
    }

    const preview = await this.storage.getInfo(plan.previewKey, 'image/png');

    if (!preview) {
      throw new NotFoundException('Plan preview was not found in storage');
    }

    return preview;
  }

  private async requireOwnedProject(
    ownerId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.projects.findAccessibleById(projectId, ownerId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async requireOwnedFloor(
    ownerId: string,
    floorId: string,
  ): Promise<FloorRow> {
    const floor = await this.floors.findById(floorId);

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    await this.requireOwnedProject(ownerId, floor.projectId);

    return floor;
  }

  private async requireOwnedPlan(
    ownerId: string,
    planId: string,
  ): Promise<PlanRow> {
    const plan = await this.plans.findById(planId);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    await this.requireOwnedFloor(ownerId, plan.floorId);

    return plan;
  }

  private async ensureFloorHasNoPlan(floorId: string): Promise<void> {
    const existing = await this.plans.findByFloor(floorId);

    if (existing) {
      throw new ConflictException('This floor already has a plan');
    }
  }

  private validatePlanFile(
    file: UploadedPlanFile | undefined,
  ): { extension: string; file: UploadedPlanFile } {
    if (!file) {
      throw new BadRequestException('Plan file is required');
    }

    if (file.size === 0) {
      throw new BadRequestException('Plan file is empty');
    }

    if (file.size > this.storage.maxUploadBytes) {
      throw new PayloadTooLargeException('Plan file is too large');
    }

    const extension = planMimeTypes.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException(
        'Only JPG, PNG, and PDF plan files are supported',
      );
    }

    return { extension, file };
  }

  private parsePdfPage(
    mimeType: string,
    value: string | undefined,
  ): number | null {
    if (mimeType !== 'application/pdf') {
      return null;
    }

    if (value === undefined || value.trim() === '') {
      return 1;
    }

    const page = Number(value);

    if (!Number.isInteger(page) || page < 1 || page > 1000) {
      throw new BadRequestException(
        'PDF page must be an integer between 1 and 1000',
      );
    }

    return page;
  }
}
