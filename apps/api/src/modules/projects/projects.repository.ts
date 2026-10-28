import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateProjectInput,
  ProjectListQuery,
  ProjectStatus,
  TemplatePlanPayload,
  UpdateProjectInput,
} from '@drawmyplace/contracts';
import { and, count, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import {
  cableRoutes,
  calibrations,
  dimensions,
  electricalPoints,
  floors,
  openings,
  plans,
  projectMembers,
  projects,
  rooms,
  walls,
  type Database,
} from '@drawmyplace/database';
import {
  renderProjectThumbnail,
  type ProjectThumbnailData,
} from './projects.thumbnail';
import { DatabaseService } from '../../database/database.service';

export type ProjectRow = typeof projects.$inferSelect;

export interface ProjectSummaryRow {
  project: ProjectRow;
  floorCount: number;
  pointCount: number;
  routeCount: number;
  roomCount: number;
  circuitCount: number;
  thumbnailSvg: string | null;
}

@Injectable()
export class ProjectsRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listByOwner(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<ProjectRow[]> {
    const conditions: SQL[] = [
      or(
        eq(projects.createdBy, ownerId),
        sql`exists (select 1 from project_members pm where pm.project_id = ${projects.id} and pm.user_id = ${ownerId})`,
      ) as SQL,
    ];

    if (status !== 'all') {
      conditions.push(eq(projects.status, status));
    }

    return this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt));
  }

  async listSummariesByOwner(
    ownerId: string,
    status: ProjectListQuery['status'],
  ): Promise<ProjectSummaryRow[]> {
    const list = await this.listByOwner(ownerId, status);
    if (list.length === 0) return [];

    const projectIds = list.map((project) => project.id);
    const floorRows = await this.db
      .select({ id: floors.id, projectId: floors.projectId })
      .from(floors)
      .where(inArray(floors.projectId, projectIds))
      .orderBy(floors.sortOrder, floors.createdAt);
    const floorToProject = new Map(
      floorRows.map((floor) => [floor.id, floor.projectId]),
    );
    const floorIds = floorRows.map((floor) => floor.id);

    const planRows =
      floorIds.length > 0
        ? await this.db
            .select({
              floorId: plans.floorId,
              settings: plans.calculationSettings,
            })
            .from(plans)
            .where(inArray(plans.floorId, floorIds))
        : [];

    const [pointCounts, routeCounts, roomCounts] = await Promise.all([
      floorIds.length > 0
        ? this.db
            .select({ floorId: electricalPoints.floorId, value: count() })
            .from(electricalPoints)
            .where(inArray(electricalPoints.floorId, floorIds))
            .groupBy(electricalPoints.floorId)
        : Promise.resolve([]),
      floorIds.length > 0
        ? this.db
            .select({ floorId: cableRoutes.floorId, value: count() })
            .from(cableRoutes)
            .where(inArray(cableRoutes.floorId, floorIds))
            .groupBy(cableRoutes.floorId)
        : Promise.resolve([]),
      floorIds.length > 0
        ? this.db
            .select({ floorId: rooms.floorId, value: count() })
            .from(rooms)
            .where(inArray(rooms.floorId, floorIds))
            .groupBy(rooms.floorId)
        : Promise.resolve([]),
    ]);

    const floorCounts = new Map<string, number>();
    for (const floor of floorRows) {
      floorCounts.set(
        floor.projectId,
        (floorCounts.get(floor.projectId) ?? 0) + 1,
      );
    }

    const countsByProject = (
      rows: readonly { floorId: string; value: number | string }[],
    ) => {
      const result = new Map<string, number>();
      for (const row of rows) {
        const projectId = floorToProject.get(row.floorId);
        if (!projectId) continue;
        result.set(
          projectId,
          (result.get(projectId) ?? 0) + Number(row.value),
        );
      }
      return result;
    };

    const pointsByProject = countsByProject(pointCounts);
    const routesByProject = countsByProject(routeCounts);
    const roomsByProject = countsByProject(roomCounts);
    const circuitsByProject = new Map<string, number>();
    for (const plan of planRows) {
      const projectId = floorToProject.get(plan.floorId);
      if (!projectId) continue;
      const circuits = (
        plan.settings as { circuits?: readonly unknown[] } | null
      )?.circuits;
      if (Array.isArray(circuits)) {
        circuitsByProject.set(
          projectId,
          (circuitsByProject.get(projectId) ?? 0) + circuits.length,
        );
      }
    }

    const firstFloorByProject = new Map<string, string>();
    for (const floor of floorRows) {
      if (!firstFloorByProject.has(floor.projectId)) {
        firstFloorByProject.set(floor.projectId, floor.id);
      }
    }
    const previewFloorIds = [...firstFloorByProject.values()];
    const [wallRows, roomRows, pointRows, routeRows] = await Promise.all([
      previewFloorIds.length > 0
        ? this.db
            .select({ floorId: walls.floorId, geometry: walls.geometry })
            .from(walls)
            .where(inArray(walls.floorId, previewFloorIds))
        : Promise.resolve([]),
      previewFloorIds.length > 0
        ? this.db
            .select({ floorId: rooms.floorId, boundary: rooms.boundary })
            .from(rooms)
            .where(inArray(rooms.floorId, previewFloorIds))
        : Promise.resolve([]),
      previewFloorIds.length > 0
        ? this.db
            .select({
              floorId: electricalPoints.floorId,
              x: electricalPoints.x,
              y: electricalPoints.y,
              type: electricalPoints.type,
            })
            .from(electricalPoints)
            .where(inArray(electricalPoints.floorId, previewFloorIds))
        : Promise.resolve([]),
      previewFloorIds.length > 0
        ? this.db
            .select({ floorId: cableRoutes.floorId, geometry: cableRoutes.geometry })
            .from(cableRoutes)
            .where(inArray(cableRoutes.floorId, previewFloorIds))
        : Promise.resolve([]),
    ]);

    const geometryByProject = new Map<string, ProjectThumbnailData>();
    const geometryFor = (floorId: string) => {
      const projectId = floorToProject.get(floorId);
      if (!projectId) return null;
      let data = geometryByProject.get(projectId);
      if (!data) {
        data = { walls: [], rooms: [], points: [], routes: [] };
        geometryByProject.set(projectId, data);
      }
      return data;
    };
    for (const row of wallRows) {
      geometryFor(row.floorId)?.walls.push({ geometry: row.geometry });
    }
    for (const row of roomRows) {
      geometryFor(row.floorId)?.rooms.push({ boundary: row.boundary });
    }
    for (const row of pointRows) {
      geometryFor(row.floorId)?.points.push({
        x: row.x,
        y: row.y,
        type: row.type,
      });
    }
    for (const row of routeRows) {
      geometryFor(row.floorId)?.routes.push({ geometry: row.geometry });
    }

    return list.map((project) => {
      const geometry = geometryByProject.get(project.id);
      return {
        project,
        floorCount: floorCounts.get(project.id) ?? 0,
        pointCount: pointsByProject.get(project.id) ?? 0,
        routeCount: routesByProject.get(project.id) ?? 0,
        roomCount: roomsByProject.get(project.id) ?? 0,
        circuitCount: circuitsByProject.get(project.id) ?? 0,
        thumbnailSvg: geometry ? renderProjectThumbnail(geometry) : null,
      };
    });
  }

  async findById(projectId: string): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return project ?? null;
  }

  async findAccessRole(
    projectId: string,
    userId: string,
  ): Promise<'owner' | 'manager' | 'electrician' | 'viewer' | null> {
    const project = await this.findOwnedById(projectId, userId);
    if (project) {
      return 'owner';
    }
    const member = await this.findProjectMember(projectId, userId);
    return (member?.role as 'manager' | 'electrician' | 'viewer' | undefined) ?? null;
  }

  async findAccessibleById(
    projectId: string,
    userId: string,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          or(
            eq(projects.createdBy, userId),
            sql`exists (select 1 from project_members pm where pm.project_id = ${projects.id} and pm.user_id = ${userId})`,
          ),
        ),
      )
      .limit(1);

    return project ?? null;
  }

  async findOwnedById(
    projectId: string,
    ownerId: string,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.createdBy, ownerId)),
      )
      .limit(1);

    return project ?? null;
  }

  async create(
    ownerId: string,
    input: CreateProjectInput,
  ): Promise<ProjectRow> {
    const [project] = await this.db
      .insert(projects)
      .values({
        createdBy: ownerId,
        name: input.name,
        description: input.description ?? null,
        organizationId: input.organizationId ?? null,
      })
      .returning();

    if (!project) {
      throw new Error('Failed to create project');
    }

    return project;
  }

  /**
   * Creates a project, its first floor/plan and the complete drawing from a
   * template in one transaction. IDs are regenerated so the same template can
   * be used any number of times.
   */
  async createFromTemplate(
    ownerId: string,
    input: {
      name: string;
      description: string | null;
      organizationId: string | null;
      payload: TemplatePlanPayload;
    },
  ): Promise<ProjectRow> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          createdBy: ownerId,
          name: input.name,
          description: input.description,
          organizationId: input.organizationId,
        })
        .returning();

      if (!project) {
        throw new Error('Failed to create project');
      }

      const [floor] = await tx
        .insert(floors)
        .values({
          projectId: project.id,
          name: 'Floor 1',
          sortOrder: 0,
        })
        .returning();

      if (!floor) {
        throw new Error('Failed to create floor');
      }

      const [plan] = await tx
        .insert(plans)
        .values({
          floorId: floor.id,
          sourceType: 'blank',
          underlay: {},
          viewport: { x: 0, y: 0, zoom: 1 },
          calculationSettings: input.payload.calculationSettings ?? {},
        })
        .returning();

      if (!plan) {
        throw new Error('Failed to create plan');
      }

      const wallIds = new Map<string, string>();
      const wallRows = input.payload.walls.map((wall) => {
        const id = randomUUID();
        wallIds.set(wall.id, id);

        return {
          id,
          floorId: floor.id,
          geometry: wall.geometry,
          thickness: wall.thickness,
          label: wall.label,
        };
      });

      if (wallRows.length > 0) {
        await tx.insert(walls).values(wallRows);
      }

      const openingRows = input.payload.openings.flatMap((opening) => {
        const wallId = wallIds.get(opening.wallId);

        if (!wallId) return [];

        return [
          {
            id: randomUUID(),
            floorId: floor.id,
            wallId,
            type: opening.type,
            offset: opening.offset,
            width: opening.width,
            height: opening.height,
            diameter: opening.diameter,
            sillHeight: opening.sillHeight,
            flipped: opening.flipped,
            label: opening.label,
          },
        ];
      });

      if (openingRows.length > 0) {
        await tx.insert(openings).values(openingRows);
      }

      const pointIds = new Map<string, string>();
      const pointRows = input.payload.points.map((point) => {
        const id = randomUUID();
        pointIds.set(point.id, id);

        return {
          id,
          floorId: floor.id,
          type: point.type,
          x: point.x,
          y: point.y,
          rotation: point.rotation,
          label: point.label,
          mountingHeight: point.mountingHeight,
          properties: point.properties,
        };
      });

      if (pointRows.length > 0) {
        await tx.insert(electricalPoints).values(pointRows);
      }

      const routeRows = input.payload.routes.map((route) => ({
        id: randomUUID(),
        floorId: floor.id,
        materialId: null,
        circuitId: route.circuitId,
        startPointId: route.startPointId
          ? (pointIds.get(route.startPointId) ?? null)
          : null,
        endPointId: route.endPointId
          ? (pointIds.get(route.endPointId) ?? null)
          : null,
        geometry: route.geometry,
        settings: route.settings,
      }));

      if (routeRows.length > 0) {
        await tx.insert(cableRoutes).values(routeRows);
      }

      const roomRows = input.payload.rooms.map((room) => ({
        id: randomUUID(),
        floorId: floor.id,
        name: room.name,
        boundary: room.boundary,
      }));

      if (roomRows.length > 0) {
        await tx.insert(rooms).values(roomRows);
      }

      const dimensionRows = input.payload.dimensions.map((dimension) => ({
        id: randomUUID(),
        floorId: floor.id,
        pointA: dimension.pointA,
        pointB: dimension.pointB,
        offset: dimension.offset,
        label: dimension.label,
      }));

      if (dimensionRows.length > 0) {
        await tx.insert(dimensions).values(dimensionRows);
      }

      const calibration = input.payload.calibration;

      if (calibration) {
        await tx.insert(calibrations).values({
          planId: plan.id,
          pointA: calibration.pointA,
          pointB: calibration.pointB,
          knownDistance: calibration.realDistance,
          unit: calibration.unit,
          metersPerPixel: calibration.metersPerUnit,
        });
      }

      return project;
    });
  }

  async updateOwned(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRow | null> {
    const changes: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
      revision: (await this.currentRevision(projectId, ownerId)) + 1,
    };

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.description !== undefined) {
      changes.description = input.description;
    }

    const conditions = [
      eq(projects.id, projectId),
      eq(projects.createdBy, ownerId),
    ];

    if (input.expectedRevision !== undefined) {
      conditions.push(eq(projects.revision, input.expectedRevision));
    }

    const [project] = await this.db
      .update(projects)
      .set(changes)
      .where(and(...conditions))
      .returning();

    return project ?? null;
  }

  private async currentRevision(projectId: string, ownerId: string): Promise<number> {
    const row = await this.findOwnedById(projectId, ownerId);
    return row?.revision ?? 0;
  }

  async setStatusOwned(
    projectId: string,
    ownerId: string,
    status: ProjectStatus,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(projects.id, projectId), eq(projects.createdBy, ownerId)),
      )
      .returning();

    return project ?? null;
  }

  async listProjectMembers(projectId: string) {
    return this.db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
  }

  async findProjectMember(projectId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async addProjectMember(
    projectId: string,
    userId: string,
    role: string,
  ) {
    const [row] = await this.db
      .insert(projectMembers)
      .values({ projectId, userId, role: role as never })
      .returning();
    return row;
  }

  async updateProjectMember(memberId: string, role: string) {
    const [row] = await this.db
      .update(projectMembers)
      .set({ role: role as never })
      .where(eq(projectMembers.id, memberId))
      .returning();
    return row ?? null;
  }

  async removeProjectMember(memberId: string) {
    await this.db.delete(projectMembers).where(eq(projectMembers.id, memberId));
  }
}
