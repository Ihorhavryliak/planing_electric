import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  buildPanelSchedule,
  buildSignalingTakeoff,
  calculateElectrical,
} from '@drawmyplace/calculations';

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
import { deviceProduct } from '@drawmyplace/contracts';
import type {
  ElectricalSettings,
  EstimateType,
  PlanCalculation,
  PublicEstimate,
  SignalingLoop,
} from '@drawmyplace/contracts';
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

  async generate(
    ownerId: string,
    planId: string,
    type: EstimateType = 'power',
  ): Promise<PublicEstimate> {
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

    // Critical electrical mismatches (overload, undersized cable, insufficient
    // breaking capacity) must be fixed before an estimate can be issued.
    const planSettings = (plan.calculationSettings ?? {}) as {
      circuits?: { id: string; name: string }[];
      electrical?: ElectricalSettings;
      signaling?: { loops?: SignalingLoop[] };
    };
    const routeLengths = new Map(
      calculation.routes.map((route) => [route.routeId, route.requiredLength]),
    );
    const circuitLengths: Record<string, number> = {};
    for (const route of drawing?.routes ?? []) {
      if (!route.circuitId) continue;
      circuitLengths[route.circuitId] =
        (circuitLengths[route.circuitId] ?? 0) +
        (routeLengths.get(route.id) ?? 0);
    }


    if (type === 'signaling') {
      if (!drawing) {
        throw new BadRequestException({
          code: 'NO_DRAWING',
          message: 'Create the plan drawing before generating a signaling estimate.',
        });
      }

      const loops = planSettings.signaling?.loops ?? [];
      if (loops.length === 0) {
        throw new BadRequestException({
          code: 'NO_SIGNALING_LOOPS',
          message:
            'Add at least one signaling loop before generating a signaling estimate.',
        });
      }

      const takeoff = buildSignalingTakeoff({
        loops,
        points: drawing.points.map((point) => {
          const product = deviceProduct(point.properties.productId ?? null);

          return {
            id: point.id,
            subtype: point.properties.subtype ?? null,
            loopId: point.properties.loopId ?? null,
            address: point.properties.address ?? null,
            zone: point.properties.zone ?? null,
            x: point.x,
            y: point.y,
            standbyA: product?.currentStandbyA ?? 0,
            alarmA: product?.currentAlarmA ?? 0,
            coverageAreaM2: product?.coverageAreaM2,
            coverageRadiusM: product?.coverageRadiusM,
            coverageAngleDeg: product?.coverageAngleDeg ?? null,
            rotation: point.rotation,
          };
        }),
        routes: drawing.routes.map((route) => ({
          id: route.id,
          system:
            (route.settings.system as
              | 'power'
              | 'security'
              | 'fire'
              | 'access'
              | 'cctv'
              | 'pa'
              | 'data'
              | undefined) ?? 'power',
          loopId: route.settings.loopId ?? null,
          mounting: route.settings.mounting ?? null,
          geometry: route.geometry,
          requiredLength: routeLengths.get(route.id) ?? null,
        })),
        rooms: drawing.rooms,
        metersPerUnit: calculation.metersPerUnit,
      });

      const critical = takeoff.issues.filter(
        (issue) => issue.severity === 'error',
      );
      if (critical.length > 0) {
        throw new BadRequestException({
          code: 'SIGNALING_COORDINATION',
          message:
            'Fix critical signaling issues before generating a signaling estimate.',
          issues: critical,
        });
      }

      const materialByCode = new Map(
        catalog.map((material) => [material.code, material]),
      );
      const grouped = new Map<
        string,
        {
          productId: string | null;
          subtype: string | null;
          count: number;
          loopCodes: Set<string>;
        }
      >();

      for (const point of drawing.points) {
        const loopId = point.properties.loopId;
        if (!loopId) continue;
        const loop = loops.find((item) => item.id === loopId);
        if (!loop) continue;
        const productId = point.properties.productId ?? null;
        const subtype = point.properties.subtype ?? point.type;
        const key = productId ?? `subtype:${subtype}`;
        const group = grouped.get(key);
        if (group) {
          group.count += 1;
          group.loopCodes.add(loop.code);
        } else {
          grouped.set(key, {
            productId,
            subtype,
            count: 1,
            loopCodes: new Set([loop.code]),
          });
        }
      }

      const items: Array<{
        materialId: string | null;
        description: string;
        unit: string;
        quantity: number;
        purchaseQuantity: number | null;
        unitPrice: number | null;
        subtotal: number | null;
        note: string | null;
      }> = [];

      for (const group of grouped.values()) {
        const product = deviceProduct(group.productId);
        const material = product?.catalogCode
          ? materialByCode.get(product.catalogCode)
          : undefined;
        const unitPrice = product?.unitPrice ?? material?.unitPrice ?? null;
        const quantity = group.count;

        items.push({
          materialId: material?.id ?? null,
          description: product
            ? `${product.manufacturer} ${product.article} — ${product.name}`
            : `Signaling device — ${group.subtype ?? 'unknown'}`,
          unit: product?.unit ?? 'pcs',
          quantity,
          purchaseQuantity: quantity,
          unitPrice,
          subtotal: unitPrice === null ? null : quantity * unitPrice,
          note: `Loop ${[...group.loopCodes].join(', ')}`,
        });
      }

      for (const result of takeoff.loops) {
        if (result.cableMeters <= 0) continue;
        const loop = loops.find((item) => item.id === result.id);
        const material = loop?.cableMaterialId
          ? materialById.get(loop.cableMaterialId)
          : defaultCable;
        const unitPrice = material?.unitPrice ?? null;
        const purchaseQuantity = Math.ceil(result.cableMeters);

        items.push({
          materialId: material?.id ?? null,
          description: `Signaling cable ${result.code} (${loop?.type ?? 'signaling'})`,
          unit: material?.unit ?? 'm',
          quantity: result.cableMeters,
          purchaseQuantity,
          unitPrice,
          subtotal: unitPrice === null ? null : purchaseQuantity * unitPrice,
          note: `${result.deviceCount} devices · ${result.addresses.length} addresses`,
        });
      }

      if (takeoff.battery.batteries > 0) {
        const battery = deviceProduct('yuasa-battery-7ah');
        const quantity = takeoff.battery.batteries;
        const unitPrice = battery?.unitPrice ?? null;

        items.push({
          materialId: null,
          description:
            battery?.name ?? 'Sealed lead-acid battery, 12 V 7 Ah',
          unit: battery?.unit ?? 'pcs',
          quantity,
          purchaseQuantity: quantity,
          unitPrice,
          subtotal: unitPrice === null ? null : quantity * unitPrice,
          note: `Battery calculation: ${takeoff.battery.requiredAh} Ah required, ${takeoff.battery.recommendedAh} Ah recommended`,
        });
      }

      const created = await this.estimates.create(
        floor.projectId,
        ownerId,
        items,
        [
          ...calculation.warnings,
          `Signaling: ${takeoff.loops.length} loops, ${takeoff.totalDevices} devices, ${takeoff.totalCableMeters} m cable, ${takeoff.battery.recommendedAh} Ah battery.`,
          ...takeoff.issues.slice(0, 20).map((issue) => {
            const params = issue.params
              ? Object.entries(issue.params)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(', ')
              : '';

            return `Signaling warning ${issue.code}${params ? ` (${params})` : ''}.`;
          }),
        ],
        'signaling',
      );

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

    const electrical = calculateElectrical({
      circuits: (planSettings.circuits ?? []).map((circuit) => ({
        id: circuit.id,
        name: circuit.name,
      })),
      devices: (drawing?.points ?? []).map((point) => ({
        id: point.id,
        circuitId: point.properties.circuitId ?? null,
        subtype: point.properties.subtype ?? null,
        type: point.type,
      })),
      settings: planSettings.electrical ?? null,
      lengthsByCircuit: circuitLengths,
      calibrated: calculation.metersPerUnit !== null,
    });
    const criticalElectrical = electrical.issues.filter(
      (issue) => issue.severity === 'error',
    );

    const panel = buildPanelSchedule(electrical);
    if (panel.issues.some((issue) => issue.code === 'panelOverflow')) {
      throw new BadRequestException({
        code: 'PANEL_OVERFLOW',
        message:
          'The panel schedule overflows. Reduce circuits or increase board ways before generating an estimate.',
        issues: panel.issues,
      });
    }

    if (criticalElectrical.length > 0) {
      throw new BadRequestException({
        code: 'ELECTRICAL_COORDINATION',
        message:
          'Fix critical electrical mismatches before generating an estimate.',
        issues: criticalElectrical,
      });
    }

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

    const electricalWarnings =
      electrical.circuits.length > 0
        ? [
            `Electrical load: ${(electrical.totalConnectedPowerW / 1_000).toFixed(2)} kW installed, ` +
              `${(electrical.totalDemandPowerW / 1_000).toFixed(2)} kW demand, ` +
              `${electrical.maxPhaseCurrentA.toFixed(1)} A design current.`,
          ]
        : [];

    const created = await this.estimates.create(
      floor.projectId,
      ownerId,
      items,
      [...calculation.warnings, ...electricalWarnings],
    );

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

  async listForUser(ownerId: string): Promise<PublicEstimate[]> {
    const projects = await this.projects.listByOwner(ownerId, 'all');
    const projectIds = projects.map((project) => project.id);
    const estimates = await this.estimates.listByProjectIds(projectIds);
    const results: PublicEstimate[] = [];
    for (const estimate of estimates) {
      const mapped = await this.getById(ownerId, estimate.id);
      if (mapped) results.push(mapped);
    }
    return results;
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
      type: estimate.type as 'power' | 'signaling',
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      warnings: estimate.warnings ?? [],
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
    estimate: { id: string; projectId: string; version: number; type?: string | null; status: string; calculationSettings: unknown; warnings?: string[]; createdAt: Date; updatedAt: Date },
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
      type: (estimate.type as 'power' | 'signaling' | null) ?? 'power',
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      warnings: estimate.warnings ?? [],
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
