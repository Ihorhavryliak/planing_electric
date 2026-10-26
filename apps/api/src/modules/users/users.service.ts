import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  cableRoutes,
  calibrations,
  dimensions,
  electricalPoints,
  estimateItems,
  estimates,
  floors,
  plans,
  projects,
  rooms,
  walls,
  type Database,
} from '@drawmyplace/database';
import { toPublicUser } from '../auth/auth.mapper';
import { AuthRepository } from '../auth/auth.repository';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  private readonly db: Database;

  constructor(
    @Inject(DatabaseService) database: DatabaseService,
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
  ) {
    this.db = database.db;
  }

  async exportAccount(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) return null;

    const projectRows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.createdBy, userId));

    const exported = [];
    for (const project of projectRows) {
      const floorRows = await this.db
        .select()
        .from(floors)
        .where(eq(floors.projectId, project.id));
      const floorIds = floorRows.map((floor) => floor.id);

      const planRows =
        floorIds.length === 0
          ? []
          : await this.db
              .select()
              .from(plans)
              .where(inArray(plans.floorId, floorIds));

      const layout =
        floorIds.length === 0
          ? { walls: [], rooms: [], dimensions: [], points: [], routes: [] }
          : await this.loadLayout(floorIds);

      const estimateRows = await this.db
        .select()
        .from(estimates)
        .where(eq(estimates.projectId, project.id));
      const estimateIds = estimateRows.map((estimate) => estimate.id);
      const itemRows =
        estimateIds.length === 0
          ? []
          : await this.db
              .select()
              .from(estimateItems)
              .where(inArray(estimateItems.estimateId, estimateIds));

      const calibrationRows =
        planRows.length === 0
          ? []
          : await this.db
              .select()
              .from(calibrations)
              .where(
                inArray(
                  calibrations.planId,
                  planRows.map((plan) => plan.id),
                ),
              );

      exported.push({
        project,
        floors: floorRows,
        plans: planRows,
        calibrations: calibrationRows,
        ...layout,
        estimates: estimateRows,
        estimateItems: itemRows,
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      user: toPublicUser(user),
      projects: exported,
    };
  }

  private async loadLayout(floorIds: string[]) {
    const [wallRows, roomRows, dimensionRows, pointRows, routeRows] =
      await Promise.all([
        this.db.select().from(walls).where(inArray(walls.floorId, floorIds)),
        this.db.select().from(rooms).where(inArray(rooms.floorId, floorIds)),
        this.db
          .select()
          .from(dimensions)
          .where(inArray(dimensions.floorId, floorIds)),
        this.db
          .select()
          .from(electricalPoints)
          .where(inArray(electricalPoints.floorId, floorIds)),
        this.db
          .select()
          .from(cableRoutes)
          .where(inArray(cableRoutes.floorId, floorIds)),
      ]);

    return {
      walls: wallRows,
      rooms: roomRows,
      dimensions: dimensionRows,
      points: pointRows,
      routes: routeRows,
    };
  }
}