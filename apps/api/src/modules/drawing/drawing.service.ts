import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  setCalibrationSchema,
  type CreateDimensionInput,
  type CreatePointInput,
  type CreateRoomInput,
  type CreateRouteInput,
  type CreateWallInput,
  type PlanCalculation,
  type PlanDrawing,
  type PublicCalibration,
  type PublicDimension,
  type PublicPoint,
  type PublicRoom,
  type PublicRoute,
  type PublicWall,
  type RouteCalculation,
  type SetCalibrationInput,
  type UpdateDimensionInput,
  type UpdatePointInput,
  type UpdateRoomInput,
  type UpdateRouteInput,
  type UpdateWallInput,
} from '@drawmyplace/contracts';
import {
  CalibrationError,
  calculateRoute,
  calibrate,
  resolveRouteDrops,
  roundTo,
  type DropPoint,
} from '@drawmyplace/calculations';
import { FloorsRepository } from '../editor/floors.repository';
import { PlansRepository, type PlanRow } from '../editor/plans.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import {
  toPublicCalibration,
  toPublicDimension,
  toPublicPoint,
  toPublicRoom,
  toPublicRoute,
  toPublicWall,
} from './drawing.mapper';
import {
  DrawingRepository,
  type DimensionRow,
  type PointRow,
  type RoomRow,
  type RouteRow,
  type WallRow,
} from './drawing.repository';

export const MAX_WALLS_PER_FLOOR = 2000;
export const MAX_ROOMS_PER_FLOOR = 1000;
export const MAX_DIMENSIONS_PER_FLOOR = 2000;
export const MAX_POINTS_PER_FLOOR = 5000;
export const MAX_ROUTES_PER_FLOOR = 2000;

@Injectable()
export class DrawingService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly projects: ProjectsRepository,
    @Inject(FloorsRepository) private readonly floors: FloorsRepository,
    @Inject(PlansRepository) private readonly plans: PlansRepository,
    @Inject(DrawingRepository) private readonly drawing: DrawingRepository,
  ) {}

  // ---------------------------------------------------------------- reading

  async getDrawing(ownerId: string, planId: string): Promise<PlanDrawing> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    const [calibration, walls, rooms, dimensions, points, routes] =
      await Promise.all([
        this.drawing.findCalibration(plan.id),
        this.drawing.listWalls(plan.floorId),
        this.drawing.listRooms(plan.floorId),
        this.drawing.listDimensions(plan.floorId),
        this.drawing.listPoints(plan.floorId),
        this.drawing.listRoutes(plan.floorId),
      ]);

    return {
      planId: plan.id,
      calibration: calibration ? toPublicCalibration(calibration) : null,
      walls: walls.map(toPublicWall),
      rooms: rooms.map(toPublicRoom),
      dimensions: dimensions.map(toPublicDimension),
      points: points.map(toPublicPoint),
      routes: routes.map(toPublicRoute),
    };
  }

  // ------------------------------------------------------------ calibration

  async setCalibration(
    ownerId: string,
    planId: string,
    input: SetCalibrationInput,
  ): Promise<PublicCalibration> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    // The controller validates too; parsing here keeps the service safe on its own.
    const parsed = setCalibrationSchema.parse(input);

    try {
      const result = calibrate({
        pointA: parsed.pointA,
        pointB: parsed.pointB,
        realDistance: parsed.realDistance,
        unit: parsed.unit,
      });
      const row = await this.drawing.upsertCalibration(plan.id, {
        pointA: parsed.pointA,
        pointB: parsed.pointB,
        knownDistance: parsed.realDistance,
        unit: parsed.unit,
        metersPerPixel: result.metersPerUnit,
      });

      return toPublicCalibration(row);
    } catch (error) {
      if (error instanceof CalibrationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async deleteCalibration(ownerId: string, planId: string): Promise<void> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    await this.drawing.deleteCalibration(plan.id);
  }

  // ------------------------------------------------------------------ walls

  async createWall(
    ownerId: string,
    planId: string,
    input: CreateWallInput,
  ): Promise<PublicWall> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if ((await this.drawing.countWalls(plan.floorId)) >= MAX_WALLS_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_WALLS_PER_FLOOR} walls`,
      );
    }

    return toPublicWall(await this.drawing.createWall(plan.floorId, input));
  }

  async updateWall(
    ownerId: string,
    wallId: string,
    input: UpdateWallInput,
  ): Promise<PublicWall> {
    const wall = await this.requireOwnedWall(ownerId, wallId);

    return toPublicWall(await this.drawing.updateWall(wall.id, input));
  }

  async deleteWall(ownerId: string, wallId: string): Promise<void> {
    const wall = await this.requireOwnedWall(ownerId, wallId);
    await this.drawing.deleteWall(wall.id);
  }

  // ------------------------------------------------------------------ rooms

  async createRoom(
    ownerId: string,
    planId: string,
    input: CreateRoomInput,
  ): Promise<PublicRoom> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if ((await this.drawing.countRooms(plan.floorId)) >= MAX_ROOMS_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_ROOMS_PER_FLOOR} rooms`,
      );
    }

    return toPublicRoom(await this.drawing.createRoom(plan.floorId, input));
  }

  async updateRoom(
    ownerId: string,
    roomId: string,
    input: UpdateRoomInput,
  ): Promise<PublicRoom> {
    const room = await this.requireOwnedRoom(ownerId, roomId);

    return toPublicRoom(await this.drawing.updateRoom(room.id, input));
  }

  async deleteRoom(ownerId: string, roomId: string): Promise<void> {
    const room = await this.requireOwnedRoom(ownerId, roomId);
    await this.drawing.deleteRoom(room.id);
  }

  // ------------------------------------------------------------- dimensions

  async createDimension(
    ownerId: string,
    planId: string,
    input: CreateDimensionInput,
  ): Promise<PublicDimension> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if (
      (await this.drawing.countDimensions(plan.floorId)) >=
      MAX_DIMENSIONS_PER_FLOOR
    ) {
      throw new ConflictException(
        `A floor can have at most ${MAX_DIMENSIONS_PER_FLOOR} dimensions`,
      );
    }

    return toPublicDimension(
      await this.drawing.createDimension(plan.floorId, input),
    );
  }

  async updateDimension(
    ownerId: string,
    dimensionId: string,
    input: UpdateDimensionInput,
  ): Promise<PublicDimension> {
    const dimension = await this.requireOwnedDimension(ownerId, dimensionId);
    const pointA = input.pointA ?? dimension.pointA;
    const pointB = input.pointB ?? dimension.pointB;

    if (pointA.x === pointB.x && pointA.y === pointB.y) {
      throw new BadRequestException('Dimension points must not coincide');
    }

    return toPublicDimension(
      await this.drawing.updateDimension(dimension.id, input),
    );
  }

  async deleteDimension(ownerId: string, dimensionId: string): Promise<void> {
    const dimension = await this.requireOwnedDimension(ownerId, dimensionId);
    await this.drawing.deleteDimension(dimension.id);
  }

  // ----------------------------------------------------------------- points

  async createPoint(
    ownerId: string,
    planId: string,
    input: CreatePointInput,
  ): Promise<PublicPoint> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if ((await this.drawing.countPoints(plan.floorId)) >= MAX_POINTS_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_POINTS_PER_FLOOR} electrical points`,
      );
    }

    return toPublicPoint(await this.drawing.createPoint(plan.floorId, input));
  }

  async updatePoint(
    ownerId: string,
    pointId: string,
    input: UpdatePointInput,
  ): Promise<PublicPoint> {
    const point = await this.requireOwnedPoint(ownerId, pointId);

    return toPublicPoint(await this.drawing.updatePoint(point.id, input));
  }

  async deletePoint(ownerId: string, pointId: string): Promise<void> {
    const point = await this.requireOwnedPoint(ownerId, pointId);
    await this.drawing.deletePoint(point.id);
  }

  // ----------------------------------------------------------------- routes

  async createRoute(
    ownerId: string,
    planId: string,
    input: CreateRouteInput,
  ): Promise<PublicRoute> {
    const plan = await this.requireOwnedPlan(ownerId, planId);

    if ((await this.drawing.countRoutes(plan.floorId)) >= MAX_ROUTES_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_ROUTES_PER_FLOOR} cable routes`,
      );
    }

    return toPublicRoute(await this.drawing.createRoute(plan.floorId, input));
  }

  async updateRoute(
    ownerId: string,
    routeId: string,
    input: UpdateRouteInput,
  ): Promise<PublicRoute> {
    const route = await this.requireOwnedRoute(ownerId, routeId);

    return toPublicRoute(await this.drawing.updateRoute(route.id, input));
  }

  async deleteRoute(ownerId: string, routeId: string): Promise<void> {
    const route = await this.requireOwnedRoute(ownerId, routeId);
    await this.drawing.deleteRoute(route.id);
  }

  // ------------------------------------------------------------ calculation

  /**
   * Authoritative server-side calculation: client-supplied quantities are never
   * trusted. Lengths are recomputed from stored geometry, calibration and points.
   */
  async calculate(ownerId: string, planId: string): Promise<PlanCalculation> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    const [calibration, pointRows, routeRows] = await Promise.all([
      this.drawing.findCalibration(plan.id),
      this.drawing.listPoints(plan.floorId),
      this.drawing.listRoutes(plan.floorId),
    ]);

    const metersPerUnit = calibration?.metersPerPixel ?? null;
    const dropPoints: DropPoint[] = pointRows.map((point) => ({
      id: point.id,
      type: point.type,
      x: point.x,
      y: point.y,
      label: point.label,
      verticalDropMeters: readDropOverride(point),
    }));

    const warnings: string[] = [];
    if (metersPerUnit === null) {
      warnings.push(
        'Plan scale is not calibrated; real cable lengths are unavailable.',
      );
    }

    const routes = routeRows.map((route) =>
      this.calculateOneRoute(route, dropPoints, metersPerUnit),
    );

    for (const route of routes) {
      warnings.push(...route.warnings);
    }

    const total =
      metersPerUnit === null
        ? null
        : roundTo(
            routes.reduce((sum, route) => sum + (route.requiredLength ?? 0), 0),
          );

    return {
      planId: plan.id,
      metersPerUnit,
      routes,
      totalRequiredLength: total,
      warnings: [...new Set(warnings)],
    };
  }

  private calculateOneRoute(
    route: RouteRow,
    points: DropPoint[],
    metersPerUnit: number | null,
  ): RouteCalculation {
    const { geometry, settings } = toPublicRoute(route);
    const name = route.circuitId ? `Route ${route.circuitId}` : 'A route';
    const drops = resolveRouteDrops({ geometry, points });
    const result = calculateRoute({
      points: geometry,
      metersPerUnit,
      drops,
      wastePercent: settings.wastePercent,
    });
    // The missing-calibration warning is reported once at plan level.
    const warnings = metersPerUnit === null ? [] : [...result.warnings];

    if (drops.length < 2) {
      warnings.push(
        `${name} has ${drops.length === 0 ? 'no end' : 'only one end'} connected to an electrical point; vertical drops may be missing.`,
      );
    }

    const dropSummary = drops.map(({ pointId, label, meters }) => ({
      pointId,
      label,
      meters,
    }));

    if (result.status === 'uncalibrated') {
      return {
        routeId: route.id,
        circuitId: route.circuitId,
        status: 'uncalibrated',
        planLength: null,
        verticalLength: null,
        wastePercent: null,
        wasteLength: null,
        requiredLength: null,
        drops: dropSummary,
        warnings,
      };
    }

    return {
      routeId: route.id,
      circuitId: route.circuitId,
      status: 'ok',
      planLength: result.breakdown.planLength,
      verticalLength: result.breakdown.verticalLength,
      wastePercent: result.breakdown.wastePercent,
      wasteLength: result.breakdown.wasteLength,
      requiredLength: result.breakdown.requiredLength,
      drops: dropSummary,
      warnings,
    };
  }

  // ----------------------------------------------------------- authorization

  /** Not-found for both missing and foreign ids, so ids cannot be probed. */
  private async requireOwnedFloorId(
    ownerId: string,
    floorId: string,
  ): Promise<void> {
    const floor = await this.floors.findById(floorId);

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    const project = await this.projects.findOwnedById(floor.projectId, ownerId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async requireOwnedPlan(
    ownerId: string,
    planId: string,
  ): Promise<PlanRow> {
    const plan = await this.plans.findById(planId);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    await this.requireOwnedFloorId(ownerId, plan.floorId);

    return plan;
  }

  private async requireOwnedWall(
    ownerId: string,
    wallId: string,
  ): Promise<WallRow> {
    const wall = await this.drawing.findWall(wallId);

    if (!wall) {
      throw new NotFoundException('Wall not found');
    }

    await this.requireOwnedFloorId(ownerId, wall.floorId);

    return wall;
  }

  private async requireOwnedRoom(
    ownerId: string,
    roomId: string,
  ): Promise<RoomRow> {
    const room = await this.drawing.findRoom(roomId);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.requireOwnedFloorId(ownerId, room.floorId);

    return room;
  }

  private async requireOwnedDimension(
    ownerId: string,
    dimensionId: string,
  ): Promise<DimensionRow> {
    const dimension = await this.drawing.findDimension(dimensionId);

    if (!dimension) {
      throw new NotFoundException('Dimension not found');
    }

    await this.requireOwnedFloorId(ownerId, dimension.floorId);

    return dimension;
  }

  private async requireOwnedPoint(
    ownerId: string,
    pointId: string,
  ): Promise<PointRow> {
    const point = await this.drawing.findPoint(pointId);

    if (!point) {
      throw new NotFoundException('Point not found');
    }

    await this.requireOwnedFloorId(ownerId, point.floorId);

    return point;
  }

  private async requireOwnedRoute(
    ownerId: string,
    routeId: string,
  ): Promise<RouteRow> {
    const route = await this.drawing.findRoute(routeId);

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    await this.requireOwnedFloorId(ownerId, route.floorId);

    return route;
  }
}

function readDropOverride(point: PointRow): number | null {
  const value = (point.properties as Record<string, unknown>).verticalDropMeters;

  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
