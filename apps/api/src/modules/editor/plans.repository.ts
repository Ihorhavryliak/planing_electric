import { Inject, Injectable } from '@nestjs/common';
import type { UpdatePlanInput } from '@drawmyplace/contracts';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { plans, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

export type PlanRow = typeof plans.$inferSelect;

interface CreatePlanValues {
  sourceType: 'blank' | 'upload';
  fileKey?: string | null;
  mimeType?: string | null;
  page?: number | null;
}

interface FileValues {
  fileKey: string;
  mimeType: string;
  page: number | null;
}

@Injectable()
export class PlansRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async listByFloorIds(floorIds: string[]): Promise<PlanRow[]> {
    if (floorIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(plans)
      .where(inArray(plans.floorId, floorIds))
      .orderBy(asc(plans.createdAt));
  }

  async findByFloor(floorId: string): Promise<PlanRow | null> {
    const [plan] = await this.db
      .select()
      .from(plans)
      .where(eq(plans.floorId, floorId))
      .orderBy(asc(plans.createdAt))
      .limit(1);

    return plan ?? null;
  }

  async findById(planId: string): Promise<PlanRow | null> {
    const [plan] = await this.db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    return plan ?? null;
  }

  async create(floorId: string, values: CreatePlanValues): Promise<PlanRow> {
    const [plan] = await this.db
      .insert(plans)
      .values({
        floorId,
        sourceType: values.sourceType,
        fileKey: values.fileKey ?? null,
        mimeType: values.mimeType ?? null,
        page: values.page ?? null,
      })
      .returning();

    if (!plan) {
      throw new Error('Failed to create plan');
    }

    return plan;
  }

  async update(
    planId: string,
    input: UpdatePlanInput,
    clearPreview = false,
  ): Promise<PlanRow> {
    const [plan] = await this.db
      .update(plans)
      .set({
        updatedAt: new Date(),
        version: sql<number>`${plans.version} + 1`,
        ...(input.underlay !== undefined ? { underlay: input.underlay } : {}),
        ...(input.viewport !== undefined ? { viewport: input.viewport } : {}),
        ...(input.page !== undefined ? { page: input.page } : {}),
        ...(clearPreview ? { previewKey: null } : {}),
      })
      .where(eq(plans.id, planId))
      .returning();

    if (!plan) {
      throw new Error('Failed to update plan');
    }

    return plan;
  }

  async replaceFile(planId: string, values: FileValues): Promise<PlanRow> {
    const [plan] = await this.db
      .update(plans)
      .set({
        sourceType: 'upload',
        fileKey: values.fileKey,
        mimeType: values.mimeType,
        page: values.page,
        previewKey: null,
        updatedAt: new Date(),
        version: sql<number>`${plans.version} + 1`,
      })
      .where(eq(plans.id, planId))
      .returning();

    if (!plan) {
      throw new Error('Failed to replace plan file');
    }

    return plan;
  }

  async setPreview(planId: string, previewKey: string): Promise<PlanRow> {
    const [plan] = await this.db
      .update(plans)
      .set({ previewKey, updatedAt: new Date() })
      .where(eq(plans.id, planId))
      .returning();

    if (!plan) {
      throw new Error('Failed to update plan preview');
    }

    return plan;
  }
}
