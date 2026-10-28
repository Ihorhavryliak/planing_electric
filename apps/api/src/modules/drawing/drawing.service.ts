import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  setCalibrationSchema,
  type CreateDimensionInput,
  type CreateOpeningInput,
  type CreatePointInput,
  type CreateRoomInput,
  type CreateRouteInput,
  type CreateWallInput,
  type PlanCalculation,
  type PlanDrawing,
  type PublicCalibration,
  type PublicDimension,
  type PublicOpening,
  type PublicPoint,
  type PublicRoom,
  type PublicRoute,
  type PublicWall,
  type RouteCalculation,
  type SetCalibrationInput,
  type UpdateDimensionInput,
  type UpdateOpeningInput,
  type UpdatePointInput,
  type UpdateRoomInput,
  type UpdateRouteInput,
  type UpdateWallInput,
} from '@drawmyplace/contracts';
import {
  CalibrationError,
  DEFAULT_VERTICAL_DROPS_METERS,
  calculateRoute,
  calibrate,
  resolveRouteDrops,
  roundTo,
  type DropPoint,
} from '@drawmyplace/calculations';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { FloorsRepository } from '../editor/floors.repository';
import { PlansRepository, type PlanRow } from '../editor/plans.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import {
  toPublicCalibration,
  toPublicDimension,
  toPublicOpening,
  toPublicPoint,
  toPublicRoom,
  toPublicRoute,
  toPublicWall,
} from './drawing.mapper';
import {
  DrawingRepository,
  type DimensionRow,
  type OpeningRow,
  type PointRow,
  type RoomRow,
  type RouteRow,
  type WallRow,
} from './drawing.repository';

export const MAX_WALLS_PER_FLOOR = 2000;
export const MAX_OPENINGS_PER_FLOOR = 2000;
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
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  private async emitFloor(floorId: string, kind: string): Promise<void> {
    const plan = await this.plans.findByFloor(floorId);
    if (plan) {
      this.realtime.emit({ planId: plan.id, version: plan.version, kind });
    }
  }

  // ---------------------------------------------------------------- reading

  async getDrawing(ownerId: string, planId: string): Promise<PlanDrawing> {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    const [calibration, walls, openings, rooms, dimensions, points, routes] =
      await Promise.all([
        this.drawing.findCalibration(plan.id),
        this.drawing.listWalls(plan.floorId),
        this.drawing.listOpenings(plan.floorId),
        this.drawing.listRooms(plan.floorId),
        this.drawing.listDimensions(plan.floorId),
        this.drawing.listPoints(plan.floorId),
        this.drawing.listRoutes(plan.floorId),
      ]);

    return {
      planId: plan.id,
      calibration: calibration ? toPublicCalibration(calibration) : null,
      walls: walls.map(toPublicWall),
      openings: openings.map(toPublicOpening),
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
    const plan = await this.requireEditablePlan(ownerId, planId);
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

      await this.emitFloor(plan.floorId, 'calibration.updated');
      return toPublicCalibration(row);
    } catch (error) {
      if (error instanceof CalibrationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async deleteCalibration(ownerId: string, planId: string): Promise<void> {
    const plan = await this.requireEditablePlan(ownerId, planId);
    await this.drawing.deleteCalibration(plan.id);
    await this.emitFloor(plan.floorId, 'calibration.deleted');
  }

  // ------------------------------------------------------------------ walls

  async createWall(
    ownerId: string,
    planId: string,
    input: CreateWallInput,
  ): Promise<PublicWall> {
    const plan = await this.requireEditablePlan(ownerId, planId);

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

  // --------------------------------------------------------------- openings

  async createOpening(
    ownerId: string,
    planId: string,
    input: CreateOpeningInput,
  ): Promise<PublicOpening> {
    const plan = await this.requireEditablePlan(ownerId, planId);

    if (
      (await this.drawing.countOpenings(plan.floorId)) >= MAX_OPENINGS_PER_FLOOR
    ) {
      throw new ConflictException(
        `A floor can have at most ${MAX_OPENINGS_PER_FLOOR} openings`,
      );
    }

    const wall = await this.drawing.findWall(input.wallId);
    if (!wall || wall.floorId !== plan.floorId) {
      throw new BadRequestException('Opening must reference a wall on this plan');
    }

    const normalized =
      input.type === 'hole'
        ? {
            ...input,
            diameter: input.diameter ?? input.width,
            width: input.diameter ?? input.width,
            height: input.diameter ?? input.width,
          }
        : input;
    this.validateOpeningAgainstWall(wall, normalized.offset, normalized.width);

    const created = await this.drawing.createOpening(
      plan.floorId,
      wall.id,
      normalized,
    );
    await this.emitFloor(plan.floorId, 'opening.created');
    return toPublicOpening(created);
  }

  async updateOpening(
    ownerId: string,
    openingId: string,
    input: UpdateOpeningInput,
  ): Promise<PublicOpening> {
    const opening = await this.requireOwnedOpening(ownerId, openingId);
    const wallId = input.wallId ?? opening.wallId;
    const wall = await this.drawing.findWall(wallId);

    if (!wall || wall.floorId !== opening.floorId) {
      throw new BadRequestException('Opening must reference a wall on this plan');
    }

    const nextType = input.type ?? opening.type;
    const nextDiameter =
      nextType === 'hole'
        ? (input.diameter ??
          input.width ??
          opening.diameter ??
          opening.width)
        : null;
    const normalized =
      nextType === 'hole'
        ? {
            ...input,
            type: 'hole' as const,
            diameter: nextDiameter ?? undefined,
            width: nextDiameter ?? input.width ?? opening.width,
            height: nextDiameter ?? input.height ?? opening.height,
          }
        : input;

    this.validateOpeningAgainstWall(
      wall,
      normalized.offset ?? opening.offset,
      normalized.width ?? opening.width,
    );

    const updated = await this.drawing.updateOpening(opening.id, normalized);
    await this.emitFloor(opening.floorId, 'opening.updated');
    return toPublicOpening(updated);
  }

  async deleteOpening(ownerId: string, openingId: string): Promise<void> {
    const opening = await this.requireOwnedOpening(ownerId, openingId);
    await this.drawing.deleteOpening(opening.id);
    await this.emitFloor(opening.floorId, 'opening.deleted');
  }

  private validateOpeningAgainstWall(
    wall: WallRow,
    offset: number,
    width: number,
  ): void {
    const length = wall.geometry.reduce((total, point, index) => {
      const next = wall.geometry[index + 1];
      return next
        ? total + Math.hypot(next.x - point.x, next.y - point.y)
        : total;
    }, 0);

    if (length > 0 && offset + width > length + 1e-6) {
      throw new BadRequestException(
        'Opening must fit within the wall length',
      );
    }
  }

  private async requireOwnedOpening(
    ownerId: string,
    openingId: string,
  ): Promise<OpeningRow> {
    const opening = await this.drawing.findOpening(openingId);
    if (!opening) {
      throw new NotFoundException('Opening not found');
    }
    await this.requireEditableFloor(ownerId, opening.floorId);
    return opening;
  }

  // ------------------------------------------------------------------ rooms

  async createRoom(
    ownerId: string,
    planId: string,
    input: CreateRoomInput,
  ): Promise<PublicRoom> {
    const plan = await this.requireEditablePlan(ownerId, planId);

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
    const plan = await this.requireEditablePlan(ownerId, planId);

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
    const plan = await this.requireEditablePlan(ownerId, planId);

    if ((await this.drawing.countPoints(plan.floorId)) >= MAX_POINTS_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_POINTS_PER_FLOOR} electrical points`,
      );
    }

    const created = await this.drawing.createPoint(plan.floorId, input);
    await this.emitFloor(plan.floorId, 'point.created');
    return toPublicPoint(created);
  }

  async updatePoint(
    ownerId: string,
    pointId: string,
    input: UpdatePointInput,
  ): Promise<PublicPoint> {
    const point = await this.requireOwnedPoint(ownerId, pointId);

    const updated = await this.drawing.updatePoint(point.id, input);
    await this.emitFloor(point.floorId, 'point.updated');
    return toPublicPoint(updated);
  }

  async deletePoint(ownerId: string, pointId: string): Promise<void> {
    const point = await this.requireOwnedPoint(ownerId, pointId);
    await this.drawing.deletePoint(point.id);
    await this.emitFloor(point.floorId, 'point.deleted');
  }

  // ----------------------------------------------------------------- routes

  private async assertRoutePins(
    floorId: string,
    input: Pick<CreateRouteInput, 'startPointId' | 'endPointId'>,
  ): Promise<void> {
    for (const [end, pointId] of [
      ['start', input.startPointId],
      ['end', input.endPointId],
    ] as const) {
      if (!pointId) continue;
      const point = await this.drawing.findPoint(pointId);

      if (!point || point.floorId !== floorId) {
        throw new BadRequestException(
          `The ${end} route pin must reference a point on the same floor.`,
        );
      }
    }
  }

  async createRoute(
    ownerId: string,
    planId: string,
    input: CreateRouteInput,
  ): Promise<PublicRoute> {
    const plan = await this.requireEditablePlan(ownerId, planId);

    if ((await this.drawing.countRoutes(plan.floorId)) >= MAX_ROUTES_PER_FLOOR) {
      throw new ConflictException(
        `A floor can have at most ${MAX_ROUTES_PER_FLOOR} cable routes`,
      );
    }

    await this.assertRoutePins(plan.floorId, input);
    const created = await this.drawing.createRoute(plan.floorId, input);
    await this.emitFloor(plan.floorId, 'route.created');
    return toPublicRoute(created);
  }

  async updateRoute(
    ownerId: string,
    routeId: string,
    input: UpdateRouteInput,
  ): Promise<PublicRoute> {
    const route = await this.requireOwnedRoute(ownerId, routeId);

    await this.assertRoutePins(route.floorId, input);
    const updated = await this.drawing.updateRoute(route.id, input);
    await this.emitFloor(route.floorId, 'route.updated');
    return toPublicRoute(updated);
  }

  async deleteRoute(ownerId: string, routeId: string): Promise<void> {
    const route = await this.requireOwnedRoute(ownerId, routeId);
    await this.drawing.deleteRoute(route.id);
    await this.emitFloor(route.floorId, 'route.deleted');
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

    const configuredDefaults =
      (plan.calculationSettings as {
        verticalDropDefaults?: Partial<Record<DropPoint['type'], number>>;
      })?.verticalDropDefaults ?? {};
    const dropDefaults = {
      ...DEFAULT_VERTICAL_DROPS_METERS,
      ...configuredDefaults,
    } as Record<DropPoint['type'], number>;

    const routes = routeRows.map((route) =>
      this.calculateOneRoute(route, dropPoints, metersPerUnit, dropDefaults),
    );

    for (const route of routes) {
      warnings.push(...route.warnings);
    }

    const validation = (
      plan.calculationSettings as {
        validation?: {
          maxCircuitLengthMeters?: number;
          requireCableType?: boolean;
        };
      }
    )?.validation ?? {};

    if (validation.requireCableType) {
      routeRows.forEach((route, index) => {
        if (!route.materialId) {
          const name = route.circuitId
            ? `Route ${route.circuitId}`
            : `Route ${index + 1}`;
          warnings.push(`${name} has no cable type assigned.`);
        }
      });
    }

    if (validation.maxCircuitLengthMeters !== undefined) {
      const max = validation.maxCircuitLengthMeters;
      routes.forEach((route, index) => {
        if (route.requiredLength !== null && route.requiredLength > max) {
          const name = route.circuitId
            ? `Route ${route.circuitId}`
            : `Route ${index + 1}`;
          warnings.push(
            `${name} is ${route.requiredLength.toFixed(1)} m, above the ${max} m circuit limit.`,
          );
        }
      });
    }

    const circuits =
      (
        plan.calculationSettings as {
          circuits?: Array<{ id: string }>;
        }
      )?.circuits ?? [];
    const circuitIds = new Set(circuits.map((circuit) => circuit.id));
    if (circuitIds.size > 0) {
      const unknown = new Set<string>();
      for (const point of pointRows) {
        const circuitId = this.readCircuitId(point);
        if (circuitId && !circuitIds.has(circuitId)) unknown.add(circuitId);
      }
      for (const route of routeRows) {
        if (route.circuitId && !circuitIds.has(route.circuitId)) {
          unknown.add(route.circuitId);
        }
      }
      for (const code of unknown) {
        warnings.push(`Unknown circuit code: ${code}.`);
      }
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

  private readCircuitId(point: { properties: Record<string, unknown> }): string | null {
    const value = point.properties.circuitId;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private calculateOneRoute(
    route: RouteRow,
    points: DropPoint[],
    metersPerUnit: number | null,
    dropDefaults: Record<DropPoint['type'], number>,
  ): RouteCalculation {
    const { geometry, settings } = toPublicRoute(route);
    const name = route.circuitId ? `Route ${route.circuitId}` : 'A route';
    const drops = resolveRouteDrops({ geometry, points, defaults: dropDefaults });
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
  private async requireEditablePlan(ownerId: string, planId: string) {
    const plan = await this.requireOwnedPlan(ownerId, planId);
    await this.requireEditableFloor(ownerId, plan.floorId);
    return plan;
  }

  private async requireEditableFloor(ownerId: string, floorId: string) {
    const floor = await this.floors.findById(floorId);
    if (!floor) {
      throw new NotFoundException('Floor not found');
    }
    const role = await this.projects.findAccessRole(floor.projectId, ownerId);
    if (!role) {
      throw new NotFoundException('Project not found');
    }
    if (role === 'viewer') {
      throw new ForbiddenException('Read-only access');
    }
  }

  private async requireOwnedFloorId(
    ownerId: string,
    floorId: string,
  ): Promise<void> {
    const floor = await this.floors.findById(floorId);

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    const project = await this.projects.findAccessibleById(floor.projectId, ownerId);

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
    await this.requireEditableFloor(ownerId, wall.floorId);

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
    await this.requireEditableFloor(ownerId, room.floorId);

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
    await this.requireEditableFloor(ownerId, dimension.floorId);

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
    await this.requireEditableFloor(ownerId, point.floorId);

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
    await this.requireEditableFloor(ownerId, route.floorId);

    return route;
  }
}

function readDropOverride(point: PointRow): number | null {
  const value = (point.properties as Record<string, unknown>).verticalDropMeters;

  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
