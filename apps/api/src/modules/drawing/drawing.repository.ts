import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import {
  cableRoutes,
  calibrations,
  dimensions,
  electricalPoints,
  openings,
  rooms,
  walls,
  type Database,
  type Point2D,
} from '@drawmyplace/database';
import type {
  CreateDimensionInput,
  CreateOpeningInput,
  CreatePointInput,
  CreateRoomInput,
  CreateRouteInput,
  CreateWallInput,
  UpdateDimensionInput,
  UpdateOpeningInput,
  UpdatePointInput,
  UpdateRoomInput,
  UpdateRouteInput,
  UpdateWallInput,
} from '@drawmyplace/contracts';
import { DatabaseService } from '../../database/database.service';

export type CalibrationRow = typeof calibrations.$inferSelect;
export type WallRow = typeof walls.$inferSelect;
export type OpeningRow = typeof openings.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;
export type DimensionRow = typeof dimensions.$inferSelect;
export type PointRow = typeof electricalPoints.$inferSelect;
export type RouteRow = typeof cableRoutes.$inferSelect;

export interface CalibrationValues {
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  knownDistance: number;
  unit: string;
  metersPerPixel: number;
}

/** Same tolerance as the calculation; a route end within it counts as attached. */
const ROUTE_END_TOLERANCE = 1e-6;

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Route ends that sit on a point move with the point, so the vertical drop is
 * not silently lost. Bends in the middle of a route never move. Returns null
 * when nothing changed.
 */
function moveAttachedEnds(
  geometry: readonly Point2D[],
  from: Point2D,
  to: Point2D,
): Point2D[] | null {
  if (geometry.length < 2) {
    return null;
  }

  const next = geometry.map((vertex) => ({ ...vertex }));
  const first = next[0];
  const last = next[next.length - 1];
  let changed = false;

  if (first && distance(first, from) <= ROUTE_END_TOLERANCE) {
    next[0] = { x: to.x, y: to.y };
    changed = true;
  }

  if (last && distance(last, from) <= ROUTE_END_TOLERANCE) {
    next[next.length - 1] = { x: to.x, y: to.y };
    changed = true;
  }

  return changed ? next : null;
}

@Injectable()
export class DrawingRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  // ------------------------------------------------------------ calibration

  async findCalibration(planId: string): Promise<CalibrationRow | null> {
    const [row] = await this.db
      .select()
      .from(calibrations)
      .where(eq(calibrations.planId, planId))
      .limit(1);

    return row ?? null;
  }

  /** One calibration per plan (unique index); recalibration replaces it. */
  async upsertCalibration(
    planId: string,
    values: CalibrationValues,
  ): Promise<CalibrationRow> {
    const [row] = await this.db
      .insert(calibrations)
      .values({ planId, ...values })
      .onConflictDoUpdate({
        target: calibrations.planId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to save calibration');
    }

    return row;
  }

  async deleteCalibration(planId: string): Promise<void> {
    await this.db.delete(calibrations).where(eq(calibrations.planId, planId));
  }

  // ------------------------------------------------------------------ walls

  listWalls(floorId: string): Promise<WallRow[]> {
    return this.db
      .select()
      .from(walls)
      .where(eq(walls.floorId, floorId))
      .orderBy(asc(walls.createdAt), asc(walls.id));
  }

  async countWalls(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(walls)
      .where(eq(walls.floorId, floorId));

    return row?.value ?? 0;
  }

  async findWall(wallId: string): Promise<WallRow | null> {
    const [row] = await this.db
      .select()
      .from(walls)
      .where(eq(walls.id, wallId))
      .limit(1);

    return row ?? null;
  }

  async createWall(floorId: string, input: CreateWallInput): Promise<WallRow> {
    const [row] = await this.db
      .insert(walls)
      .values({
        floorId,
        geometry: input.geometry,
        thickness: input.thickness ?? null,
        label: input.label ?? null,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create wall');
    }

    return row;
  }

  async updateWall(wallId: string, input: UpdateWallInput): Promise<WallRow> {
    const [row] = await this.db
      .update(walls)
      .set({
        updatedAt: new Date(),
        ...(input.geometry !== undefined ? { geometry: input.geometry } : {}),
        ...(input.thickness !== undefined
          ? { thickness: input.thickness }
          : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      })
      .where(eq(walls.id, wallId))
      .returning();

    if (!row) {
      throw new Error('Failed to update wall');
    }

    return row;
  }

  async deleteWall(wallId: string): Promise<void> {
    await this.db.delete(walls).where(eq(walls.id, wallId));
  }

  // --------------------------------------------------------------- openings

  listOpenings(floorId: string): Promise<OpeningRow[]> {
    return this.db
      .select()
      .from(openings)
      .where(eq(openings.floorId, floorId))
      .orderBy(asc(openings.createdAt), asc(openings.id));
  }

  async countOpenings(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(openings)
      .where(eq(openings.floorId, floorId));
    return Number(row?.value ?? 0);
  }

  async findOpening(openingId: string): Promise<OpeningRow | null> {
    const [row] = await this.db
      .select()
      .from(openings)
      .where(eq(openings.id, openingId))
      .limit(1);
    return row ?? null;
  }

  async createOpening(
    floorId: string,
    wallId: string,
    input: CreateOpeningInput,
  ): Promise<OpeningRow> {
    const [row] = await this.db
      .insert(openings)
      .values({
        floorId,
        wallId,
        type: input.type,
        offset: input.offset,
        width: input.width,
        height:
          input.type === 'hole'
            ? (input.diameter ?? input.width)
            : (input.height ?? 210),
        diameter:
          input.type === 'hole' ? (input.diameter ?? input.width) : null,
        sillHeight: input.sillHeight ?? 0,
        flipped: input.flipped ?? false,
        label: input.label ?? null,
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create opening');
    }
    return row;
  }

  async updateOpening(
    openingId: string,
    input: UpdateOpeningInput,
  ): Promise<OpeningRow> {
    const [row] = await this.db
      .update(openings)
      .set({
        updatedAt: new Date(),
        ...(input.wallId !== undefined ? { wallId: input.wallId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.offset !== undefined ? { offset: input.offset } : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
        ...(input.diameter !== undefined
          ? { diameter: input.diameter }
          : {}),
        ...(input.sillHeight !== undefined
          ? { sillHeight: input.sillHeight }
          : {}),
        ...(input.flipped !== undefined ? { flipped: input.flipped } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      })
      .where(eq(openings.id, openingId))
      .returning();
    if (!row) {
      throw new Error('Failed to update opening');
    }
    return row;
  }

  async deleteOpening(openingId: string): Promise<void> {
    await this.db.delete(openings).where(eq(openings.id, openingId));
  }

  // ------------------------------------------------------------------ rooms

  listRooms(floorId: string): Promise<RoomRow[]> {
    return this.db
      .select()
      .from(rooms)
      .where(eq(rooms.floorId, floorId))
      .orderBy(asc(rooms.createdAt), asc(rooms.id));
  }

  async countRooms(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(rooms)
      .where(eq(rooms.floorId, floorId));

    return row?.value ?? 0;
  }

  async findRoom(roomId: string): Promise<RoomRow | null> {
    const [row] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    return row ?? null;
  }

  async createRoom(floorId: string, input: CreateRoomInput): Promise<RoomRow> {
    const [row] = await this.db
      .insert(rooms)
      .values({
        floorId,
        name: input.name,
        boundary: input.boundary,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create room');
    }

    return row;
  }

  async updateRoom(roomId: string, input: UpdateRoomInput): Promise<RoomRow> {
    const [row] = await this.db
      .update(rooms)
      .set({
        updatedAt: new Date(),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.boundary !== undefined ? { boundary: input.boundary } : {}),
      })
      .where(eq(rooms.id, roomId))
      .returning();

    if (!row) {
      throw new Error('Failed to update room');
    }

    return row;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.db.delete(rooms).where(eq(rooms.id, roomId));
  }

  // ------------------------------------------------------------- dimensions

  listDimensions(floorId: string): Promise<DimensionRow[]> {
    return this.db
      .select()
      .from(dimensions)
      .where(eq(dimensions.floorId, floorId))
      .orderBy(asc(dimensions.createdAt), asc(dimensions.id));
  }

  async countDimensions(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(dimensions)
      .where(eq(dimensions.floorId, floorId));

    return row?.value ?? 0;
  }

  async findDimension(dimensionId: string): Promise<DimensionRow | null> {
    const [row] = await this.db
      .select()
      .from(dimensions)
      .where(eq(dimensions.id, dimensionId))
      .limit(1);

    return row ?? null;
  }

  async createDimension(
    floorId: string,
    input: CreateDimensionInput,
  ): Promise<DimensionRow> {
    const [row] = await this.db
      .insert(dimensions)
      .values({
        floorId,
        pointA: input.pointA,
        pointB: input.pointB,
        offset: input.offset,
        label: input.label ?? null,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create dimension');
    }

    return row;
  }

  async updateDimension(
    dimensionId: string,
    input: UpdateDimensionInput,
  ): Promise<DimensionRow> {
    const [row] = await this.db
      .update(dimensions)
      .set({
        updatedAt: new Date(),
        ...(input.pointA !== undefined ? { pointA: input.pointA } : {}),
        ...(input.pointB !== undefined ? { pointB: input.pointB } : {}),
        ...(input.offset !== undefined ? { offset: input.offset } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      })
      .where(eq(dimensions.id, dimensionId))
      .returning();

    if (!row) {
      throw new Error('Failed to update dimension');
    }

    return row;
  }

  async deleteDimension(dimensionId: string): Promise<void> {
    await this.db.delete(dimensions).where(eq(dimensions.id, dimensionId));
  }

  // ----------------------------------------------------------------- points

  listPoints(floorId: string): Promise<PointRow[]> {
    return this.db
      .select()
      .from(electricalPoints)
      .where(eq(electricalPoints.floorId, floorId))
      .orderBy(asc(electricalPoints.createdAt), asc(electricalPoints.id));
  }

  async countPoints(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(electricalPoints)
      .where(eq(electricalPoints.floorId, floorId));

    return row?.value ?? 0;
  }

  async findPoint(pointId: string): Promise<PointRow | null> {
    const [row] = await this.db
      .select()
      .from(electricalPoints)
      .where(eq(electricalPoints.id, pointId))
      .limit(1);

    return row ?? null;
  }

  async createPoint(
    floorId: string,
    input: CreatePointInput,
  ): Promise<PointRow> {
    const [row] = await this.db
      .insert(electricalPoints)
      .values({
        floorId,
        type: input.type,
        x: input.x,
        y: input.y,
        rotation: input.rotation,
        label: input.label ?? null,
        mountingHeight: input.mountingHeight ?? null,
        properties: input.properties,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create point');
    }

    return row;
  }

  /**
   * Updates a point. When it changes position, every route end attached to the
   * old position is moved in the same transaction, keeping drops connected.
   */
  async updatePoint(
    pointId: string,
    input: UpdatePointInput,
  ): Promise<PointRow> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(electricalPoints)
        .where(eq(electricalPoints.id, pointId))
        .limit(1);

      if (!current) {
        throw new Error('Failed to update point');
      }

      const nextX = input.x ?? current.x;
      const nextY = input.y ?? current.y;

      if (nextX !== current.x || nextY !== current.y) {
        const routes = await tx
          .select()
          .from(cableRoutes)
          .where(eq(cableRoutes.floorId, current.floorId));

        for (const route of routes) {
          const geometry = moveAttachedEnds(
            route.geometry,
            { x: current.x, y: current.y },
            { x: nextX, y: nextY },
          );

          if (geometry) {
            await tx
              .update(cableRoutes)
              .set({ geometry, updatedAt: new Date() })
              .where(eq(cableRoutes.id, route.id));
          }
        }
      }

      const [row] = await tx
        .update(electricalPoints)
        .set({
          updatedAt: new Date(),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.x !== undefined ? { x: input.x } : {}),
          ...(input.y !== undefined ? { y: input.y } : {}),
          ...(input.rotation !== undefined ? { rotation: input.rotation } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.mountingHeight !== undefined
            ? { mountingHeight: input.mountingHeight }
            : {}),
          ...(input.properties !== undefined
            ? { properties: input.properties }
            : {}),
        })
        .where(eq(electricalPoints.id, pointId))
        .returning();

      if (!row) {
        throw new Error('Failed to update point');
      }

      return row;
    });
  }

  async deletePoint(pointId: string): Promise<void> {
    await this.db
      .delete(electricalPoints)
      .where(eq(electricalPoints.id, pointId));
  }

  // ----------------------------------------------------------------- routes

  listRoutes(floorId: string): Promise<RouteRow[]> {
    return this.db
      .select()
      .from(cableRoutes)
      .where(eq(cableRoutes.floorId, floorId))
      .orderBy(asc(cableRoutes.createdAt), asc(cableRoutes.id));
  }

  async countRoutes(floorId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(cableRoutes)
      .where(eq(cableRoutes.floorId, floorId));

    return row?.value ?? 0;
  }

  async findRoute(routeId: string): Promise<RouteRow | null> {
    const [row] = await this.db
      .select()
      .from(cableRoutes)
      .where(eq(cableRoutes.id, routeId))
      .limit(1);

    return row ?? null;
  }

  async createRoute(
    floorId: string,
    input: CreateRouteInput,
  ): Promise<RouteRow> {
    const [row] = await this.db
      .insert(cableRoutes)
      .values({
        floorId,
        geometry: input.geometry,
        circuitId: input.circuitId ?? null,
        materialId: input.materialId ?? null,
        startPointId: input.startPointId ?? null,
        endPointId: input.endPointId ?? null,
        settings: input.settings,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create route');
    }

    return row;
  }

  async updateRoute(
    routeId: string,
    input: UpdateRouteInput,
  ): Promise<RouteRow> {
    const [row] = await this.db
      .update(cableRoutes)
      .set({
        updatedAt: new Date(),
        ...(input.geometry !== undefined ? { geometry: input.geometry } : {}),
        ...(input.circuitId !== undefined
          ? { circuitId: input.circuitId }
          : {}),
        ...(input.materialId !== undefined
          ? { materialId: input.materialId }
          : {}),
        ...(input.startPointId !== undefined
          ? { startPointId: input.startPointId }
          : {}),
        ...(input.endPointId !== undefined
          ? { endPointId: input.endPointId }
          : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
      })
      .where(eq(cableRoutes.id, routeId))
      .returning();

    if (!row) {
      throw new Error('Failed to update route');
    }

    return row;
  }

  async deleteRoute(routeId: string): Promise<void> {
    await this.db.delete(cableRoutes).where(eq(cableRoutes.id, routeId));
  }
}
