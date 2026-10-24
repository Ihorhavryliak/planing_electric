import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, max } from 'drizzle-orm';
import { floors, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

export type FloorRow = typeof floors.$inferSelect;

@Injectable()
export class FloorsRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listByProject(projectId: string): Promise<FloorRow[]> {
    return this.db
      .select()
      .from(floors)
      .where(eq(floors.projectId, projectId))
      .orderBy(asc(floors.sortOrder), asc(floors.createdAt));
  }

  async findById(floorId: string): Promise<FloorRow | null> {
    const [floor] = await this.db
      .select()
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);

    return floor ?? null;
  }

  async create(projectId: string, name: string): Promise<FloorRow> {
    const [sortOrder] = await this.db
      .select({ value: max(floors.sortOrder) })
      .from(floors)
      .where(eq(floors.projectId, projectId));

    const [floor] = await this.db
      .insert(floors)
      .values({
        projectId,
        name,
        sortOrder: (sortOrder?.value ?? -1) + 1,
      })
      .returning();

    if (!floor) {
      throw new Error('Failed to create floor');
    }

    return floor;
  }
}
