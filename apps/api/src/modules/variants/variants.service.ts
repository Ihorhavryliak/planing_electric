import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  cableRoutes,
  calibrations,
  dimensions,
  electricalPoints,
  floors,
  openings,
  plans,
  rooms,
  walls,
  type Database,
} from '@drawmyplace/database';
import type {
  PublicMaterial,
  PublicVariant,
  VariantMetrics,
} from '@drawmyplace/contracts';
import {
  DEFAULT_VERTICAL_DROPS_METERS,
  calculateRoute,
  resolveRouteDrops,
  roundTo,
  type DropPoint,
} from '@drawmyplace/calculations';
import { ProjectsRepository } from '../projects/projects.repository';
import { DatabaseService } from '../../database/database.service';
import { MaterialsService } from '../materials/materials.service';
import { VariantsRepository } from './variants.repository';

@Injectable()
export class VariantsService {
  private readonly db: Database;

  constructor(
    @Inject(DatabaseService) database: DatabaseService,
    @Inject(VariantsRepository) private readonly repository: VariantsRepository,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
    @Inject(MaterialsService) private readonly materials: MaterialsService,
  ) {
    this.db = database.db;
  }

  async list(userId: string, projectId: string): Promise<PublicVariant[] | null> {
    if (!(await this.canManage(userId, projectId))) {
      return null;
    }
    const rows = await this.repository.listByProject(projectId);
    const catalog = await this.materials.list();
    return rows.map((row) => this.toPublic(row, catalog));
  }

  async create(
    userId: string,
    projectId: string,
    name: string,
  ): Promise<PublicVariant | null> {
    if (!(await this.canManage(userId, projectId))) {
      return null;
    }
    const duplicate = await this.repository.findByName(projectId, name);
    if (duplicate) {
      return null;
    }
    const data = await this.snapshot(projectId);
    const row = await this.repository.create({ projectId, name, data });
    if (!row) return null;
    const catalog = await this.materials.list();
    return this.toPublic(row, catalog);
  }

  async update(
    userId: string,
    variantId: string,
    input: { name?: string; status?: 'active' | 'archived' },
  ): Promise<PublicVariant | null> {
    const row = await this.repository.findById(variantId);
    if (!row) return null;
    if (!(await this.canManage(userId, row.projectId))) {
      return null;
    }
    if (input.name && (await this.repository.findByName(row.projectId, input.name))) {
      return null;
    }
    const updated = await this.repository.update(variantId, input);
    if (!updated) return null;
    const catalog = await this.materials.list();
    return this.toPublic(updated, catalog);
  }

  async duplicate(
    userId: string,
    variantId: string,
  ): Promise<PublicVariant | null> {
    const row = await this.repository.findById(variantId);
    if (!row) return null;
    if (!(await this.canManage(userId, row.projectId))) {
      return null;
    }
    let name = `${row.name} copy`;
    let suffix = 2;
    while (await this.repository.findByName(row.projectId, name)) {
      name = `${row.name} copy ${suffix}`;
      suffix += 1;
    }
    const created = await this.repository.create({
      projectId: row.projectId,
      name,
      data: row.data as Record<string, unknown>,
    });
    if (!created) return null;
    const catalog = await this.materials.list();
    return this.toPublic(created, catalog);
  }

  private async canManage(userId: string, projectId: string): Promise<boolean> {
    const role = await this.projects.findAccessRole(projectId, userId);
    return role === 'owner' || role === 'manager';
  }

  private async snapshot(projectId: string): Promise<Record<string, unknown>> {
    const floorRows = await this.db
      .select()
      .from(floors)
      .where(eq(floors.projectId, projectId));
    const floorIds = floorRows.map((floor) => floor.id);

    const planRows =
      floorIds.length === 0
        ? []
        : await this.db
            .select()
            .from(plans)
            .where(inArray(plans.floorId, floorIds));

    const planIds = planRows.map((plan) => plan.id);
    const [wallRows, roomRows, dimensionRows, openingRows, pointRows, routeRows, calibrationRows] =
      floorIds.length === 0
        ? [[], [], [], [], [], [], []]
        : await Promise.all([
            this.db.select().from(walls).where(inArray(walls.floorId, floorIds)),
            this.db.select().from(rooms).where(inArray(rooms.floorId, floorIds)),
            this.db
              .select()
              .from(dimensions)
              .where(inArray(dimensions.floorId, floorIds)),
            this.db
              .select()
              .from(openings)
              .where(inArray(openings.floorId, floorIds)),
            this.db
              .select()
              .from(electricalPoints)
              .where(inArray(electricalPoints.floorId, floorIds)),
            this.db
              .select()
              .from(cableRoutes)
              .where(inArray(cableRoutes.floorId, floorIds)),
            planIds.length === 0
              ? Promise.resolve([])
              : this.db
                  .select()
                  .from(calibrations)
                  .where(inArray(calibrations.planId, planIds)),
          ]);

    return JSON.parse(
      JSON.stringify({
        floors: floorRows,
        plans: planRows,
        calibrations: calibrationRows,
        walls: wallRows,
        rooms: roomRows,
        dimensions: dimensionRows,
        openings: openingRows,
        points: pointRows,
        routes: routeRows,
      }),
    ) as Record<string, unknown>;
  }

  private toPublic(
    row: NonNullable<Awaited<ReturnType<VariantsRepository['findById']>>>,
    catalog: PublicMaterial[],
  ): PublicVariant {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      status: row.status,
      metrics: this.metrics(data, catalog),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private metrics(
    data: Record<string, unknown>,
    catalog: PublicMaterial[],
  ): VariantMetrics {
    const plans = (data.plans ?? []) as Array<{
      id: string;
      calculationSettings?: {
        verticalDropDefaults?: Record<string, number>;
      };
    }>;
    const calibrations = (data.calibrations ?? []) as Array<{
      planId: string;
      metersPerPixel: number;
    }>;
    const points = (data.points ?? []) as Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      label: string | null;
      properties?: { verticalDropMeters?: number };
    }>;
    const routes = (data.routes ?? []) as Array<{
      id: string;
      materialId: string | null;
      geometry: Array<{ x: number; y: number }>;
      settings: { wastePercent?: number };
    }>;

    const calibrationByPlan = new Map(
      calibrations.map((item) => [item.planId, item.metersPerPixel]),
    );
    const defaults = {
      ...DEFAULT_VERTICAL_DROPS_METERS,
      ...(plans[0]?.calculationSettings?.verticalDropDefaults ?? {}),
    } as Record<DropPoint['type'], number>;

    const dropPoints: DropPoint[] = points.map((point) => ({
      id: point.id,
      type: point.type as DropPoint['type'],
      x: point.x,
      y: point.y,
      label: point.label,
      verticalDropMeters: point.properties?.verticalDropMeters ?? null,
    }));

    const metersPerUnit = calibrationByPlan.get(plans[0]?.id ?? '') ?? null;
    const materialById = new Map(catalog.map((item) => [item.id, item]));
    const defaultCable =
      catalog.find((item) => item.category === 'cable') ?? catalog[0] ?? null;
    const materialTotals = new Map<string | null, number>();
    let total = 0;
    let warnings = 0;
    let estimatedCost = 0;
    let hasUnpricedRoute = false;

    for (const route of routes) {
      const drops = resolveRouteDrops({
        geometry: route.geometry,
        points: dropPoints,
        defaults,
      });
      const result = calculateRoute({
        points: route.geometry,
        metersPerUnit,
        drops,
        wastePercent: route.settings?.wastePercent,
      });
      warnings += result.warnings.length + (drops.length < 2 ? 1 : 0);
      if (result.status === 'ok') {
        const quantity = result.breakdown.requiredLength;
        const material =
          (route.materialId ? materialById.get(route.materialId) : null) ??
          defaultCable;
        total += quantity;
        materialTotals.set(
          route.materialId,
          (materialTotals.get(route.materialId) ?? 0) + quantity,
        );

        if (quantity > 0) {
          if (material?.unitPrice == null) {
            hasUnpricedRoute = true;
          } else {
            estimatedCost += Math.ceil(quantity) * material.unitPrice;
          }
        }
      }
    }

    return {
      totalRequiredLength: metersPerUnit === null ? null : roundTo(total),
      estimatedCost:
        metersPerUnit === null || routes.length === 0 || hasUnpricedRoute
          ? null
          : Math.round(estimatedCost * 100) / 100,
      routeCount: routes.length,
      pointCount: points.length,
      warningCount: warnings + (metersPerUnit === null ? 1 : 0),
      materials: [...materialTotals.entries()].map(([materialId, quantity]) => ({
        materialId,
        name: materialId ? (materialById.get(materialId)?.name ?? null) : null,
        quantity: roundTo(quantity),
      })),
    };
  }
}