import { Inject, Injectable } from '@nestjs/common';

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
import type { PlanCalculation, PublicEstimate } from '@drawmyplace/contracts';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { DrawingService } from '../drawing/drawing.service';
import { FloorsRepository } from '../editor/floors.repository';
import { PlansRepository } from '../editor/plans.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { MaterialsService } from '../materials/materials.service';
import { MaterialsRepository } from '../materials/materials.repository';
import { EstimatesRepository } from './estimates.repository';

@Injectable()
export class EstimatesService {
  constructor(
    @Inject(ActivityLogService) private readonly activity: ActivityLogService,
    @Inject(DrawingService) private readonly drawing: DrawingService,
    @Inject(PlansRepository) private readonly plans: PlansRepository,
    @Inject(FloorsRepository) private readonly floors: FloorsRepository,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
    @Inject(MaterialsService) private readonly materials: MaterialsService,
    @Inject(MaterialsRepository) private readonly materialsRepo: MaterialsRepository,
    @Inject(EstimatesRepository) private readonly estimates: EstimatesRepository,
  ) {}

  async generate(ownerId: string, planId: string): Promise<PublicEstimate> {
    const plan = await this.plans.findById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const floor = await this.floors.findById(plan.floorId);
    if (!floor) {
      throw new Error('Floor not found');
    }

    const calculation: PlanCalculation = await this.drawing.calculate(
      ownerId,
      planId,
    );

    const catalog = await this.materials.list();
    const defaultCable =
      catalog.find((item) => item.category === 'cable') ?? catalog[0] ?? null;
    const materialById = new Map(catalog.map((item) => [item.id, item]));

    // Re-read the plan's routes to pick up the assigned cable type (materialId).
    const drawing = await this.drawing.getDrawing(ownerId, planId);
    const routeMaterialById = new Map(
      (drawing?.routes ?? []).map((route) => [route.id, route.materialId]),
    );

    const items = calculation.routes.map((route) => {
      const quantity = route.requiredLength ?? 0;
      const assignedId = routeMaterialById.get(route.routeId) ?? null;
      const material =
        (assignedId ? materialById.get(assignedId) : null) ?? defaultCable;
      const unitPrice = material?.unitPrice ?? null;
      const purchaseQuantity = Math.ceil(quantity);
      const subtotal =
        unitPrice === null ? null : purchaseQuantity * unitPrice;

      return {
        materialId: material?.id ?? null,
        description: route.circuitId
          ? `Cable route ${route.circuitId}`
          : 'Cable route',
        unit: material?.unit ?? 'm',
        quantity,
        purchaseQuantity: quantity > 0 ? purchaseQuantity : 0,
        unitPrice,
        subtotal,
        note: null,
      };
    });

    const created = await this.estimates.create(floor.projectId, ownerId, items);

    const result = await this.getById(ownerId, created.id);

    if (!result) {
      throw new Error('Failed to load estimate');
    }

    await this.activity.record({
      projectId: floor.projectId,
      actorId: ownerId,
      action: 'estimate.generated',
      resourceType: 'estimate',
      resourceId: created.id,
    });

    return result;
  }

  async listByProject(ownerId: string, projectId: string): Promise<PublicEstimate[]> {
    const project = await this.projects.findAccessibleById(projectId, ownerId);
    if (!project) {
      return [];
    }
    const estimates = await this.estimates.listByProject(projectId);
    const results: PublicEstimate[] = [];
    for (const estimate of estimates) {
      const mapped = await this.getById(ownerId, estimate.id);
      if (mapped) results.push(mapped);
    }
    return results;
  }

  async updateItem(
    ownerId: string,
    itemId: string,
    input: {
      quantity?: number;
      purchaseQuantity?: number | null;
      unitPrice?: number | null;
      note?: string | null;
      isOverridden?: boolean;
    },
  ): Promise<PublicEstimate | null> {
    const item = await this.estimates.findItemById(itemId);
    if (!item) return null;
    const loaded = await this.estimates.findById(item.estimateId);
    if (!loaded) return null;
    const project = await this.projects.findAccessibleById(
      loaded.estimate.projectId,
      ownerId,
    );
    if (!project) return null;

    const patch: Parameters<EstimatesRepository['updateItem']>[1] = {};
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.purchaseQuantity !== undefined)
      patch.purchaseQuantity = input.purchaseQuantity;
    if (input.unitPrice !== undefined) patch.unitPrice = input.unitPrice;
    if (input.note !== undefined) patch.note = input.note;
    if (input.isOverridden !== undefined) patch.isOverridden = input.isOverridden;

    // Recompute subtotal when quantity/price changed unless explicitly overridden? Simple: recompute.
    const nextQuantity =
      input.quantity !== undefined ? input.quantity : Number(item.quantity);
    const nextPurchase =
      input.purchaseQuantity !== undefined
        ? input.purchaseQuantity
        : item.purchaseQuantity === null
          ? null
          : Number(item.purchaseQuantity);
    const nextPrice =
      input.unitPrice !== undefined ? input.unitPrice : 
        item.unitPrice === null ? null : Number(item.unitPrice);
    const qtyForSubtotal = nextPurchase ?? nextQuantity;
    if (nextPrice !== null) {
      patch.subtotal = qtyForSubtotal * nextPrice;
    }
    patch.isOverridden = input.isOverridden ?? true;

    await this.estimates.updateItem(itemId, patch);
    return this.getById(ownerId, loaded.estimate.id);
  }

  async updateStatus(
    ownerId: string,
    estimateId: string,
    status: 'draft' | 'final',
  ): Promise<PublicEstimate | null> {
    const loaded = await this.estimates.findById(estimateId);
    if (!loaded) return null;
    const project = await this.projects.findAccessibleById(
      loaded.estimate.projectId,
      ownerId,
    );
    if (!project) return null;
    await this.estimates.updateStatus(estimateId, status);
    return this.getById(ownerId, estimateId);
  }

  async getById(ownerId: string, estimateId: string): Promise<PublicEstimate | null> {
    const result = await this.estimates.findById(estimateId);
    if (!result) {
      return null;
    }

    const project = await this.projects.findAccessibleById(result.estimate.projectId, ownerId);
    if (!project) {
      return null;
    }

    const { estimate, items } = result;
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      version: estimate.version,
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      items: items.map((item) => ({
        id: item.id,
        estimateId: item.estimateId,
        materialId: item.materialId,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        purchaseQuantity:
          item.purchaseQuantity === null ? null : Number(item.purchaseQuantity),
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
        subtotal: item.subtotal === null ? null : Number(item.subtotal),
        isOverridden: item.isOverridden,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
    };
  }

  async toPdf(ownerId: string, estimateId: string): Promise<Buffer> {
    const estimate = await this.getById(ownerId, estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const lines = [
      'Estimate',
      `ID: ${estimate.id}`,
      `Project: ${estimate.projectId}`,
      `Version: ${estimate.version}`,
      `Status: ${estimate.status}`,
      '',
      'description,unit,quantity,purchase,price,subtotal',
      ...estimate.items.map(
        (item) =>
          `${item.description} | ${item.unit} | ${item.quantity} | ${
            item.purchaseQuantity ?? ''
          } | ${item.unitPrice ?? ''} | ${item.subtotal ?? ''}`,
      ),
    ];

    const content = lines
      .map((line, index) => `BT /F1 10 Tf 50 ${780 - index * 14} Td (${escapePdf(line)}) Tj ET`)
      .join('\n');

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
  }

  async toCsv(ownerId: string, estimateId: string): Promise<string> {
    const estimate = await this.getById(ownerId, estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const lines = [
      'description,unit,quantity,purchaseQuantity,unitPrice,subtotal',
      ...estimate.items.map((item) =>
        [
          JSON.stringify(item.description),
          item.unit,
          item.quantity,
          item.purchaseQuantity ?? '',
          item.unitPrice ?? '',
          item.subtotal ?? '',
        ].join(','),
      ),
    ];

    return lines.join('\\n');
  }

  private toPublic(
    estimate: { id: string; projectId: string; version: number; status: string; calculationSettings: unknown; createdAt: Date; updatedAt: Date },
    items: Array<{
      materialId: string | null;
      description: string;
      unit: string;
      quantity: number;
      purchaseQuantity: number | null;
      unitPrice: number | null;
      subtotal: number | null;
      note: string | null;
    }>,
  ): PublicEstimate {
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      version: estimate.version,
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      items: items.map((item, index) => ({
        id: `temp-${index}`,
        estimateId: estimate.id,
        materialId: item.materialId,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        purchaseQuantity: item.purchaseQuantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        isOverridden: false,
        note: item.note,
        createdAt: estimate.createdAt.toISOString(),
      })),
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
    };
  }
}
