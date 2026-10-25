import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { materials, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

export type MaterialRow = typeof materials.$inferSelect;

@Injectable()
export class MaterialsRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listActive(organizationId: string | null = null): Promise<MaterialRow[]> {
    const condition =
      organizationId === null
        ? eq(materials.active, true)
        : and(eq(materials.active, true), eq(materials.organizationId, organizationId));

    return this.db.select().from(materials).where(condition);
  }

  async findById(id: string): Promise<MaterialRow | null> {
    const [row] = await this.db
      .select()
      .from(materials)
      .where(eq(materials.id, id))
      .limit(1);

    return row ?? null;
  }
}
