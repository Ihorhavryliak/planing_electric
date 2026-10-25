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

  async create(input: {
    code: string;
    name: string;
    unit: string;
    category: string | null;
    unitPrice: number | null;
    currency: string;
    organizationId: string | null;
    active: boolean;
  }) {
    const [row] = await this.db
      .insert(materials)
      .values({
        code: input.code,
        name: input.name,
        unit: input.unit,
        category: input.category as never,
        unitPrice: input.unitPrice?.toString() ?? null,
        currency: input.currency,
        organizationId: input.organizationId,
        active: input.active,
      })
      .returning();
    return row;
  }

  async update(id: string, input: Partial<{
    code: string;
    name: string;
    unit: string;
    category: string | null;
    unitPrice: number | null;
    currency: string;
    active: boolean;
  }>) {
    const changes: Record<string, unknown> = { updatedAt: new Date() };
    if (input.code !== undefined) changes.code = input.code;
    if (input.name !== undefined) changes.name = input.name;
    if (input.unit !== undefined) changes.unit = input.unit;
    if (input.category !== undefined) changes.category = input.category;
    if (input.unitPrice !== undefined)
      changes.unitPrice = input.unitPrice?.toString() ?? null;
    if (input.currency !== undefined) changes.currency = input.currency;
    if (input.active !== undefined) changes.active = input.active;
    const [row] = await this.db
      .update(materials)
      .set(changes as never)
      .where(eq(materials.id, id))
      .returning();
    return row ?? null;
  }
}
