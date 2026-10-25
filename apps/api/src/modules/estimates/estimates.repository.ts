import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray, max } from 'drizzle-orm';
import { estimates, estimateItems, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class EstimatesRepository {
  private readonly db: Database;

  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async nextVersion(projectId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: max(estimates.version) })
      .from(estimates)
      .where(eq(estimates.projectId, projectId));

    return (row?.value ?? 0) + 1;
  }

  async create(
    projectId: string,
    createdBy: string | null,
    items: Array<{
      materialId: string | null;
      description: string;
      unit: string;
      quantity: number;
      purchaseQuantity: number | null;
      unitPrice: number | null;
      subtotal: number | null;
      note: string | null;
    }>,
  ) {
    const version = await this.nextVersion(projectId);
    const [estimate] = await this.db
      .insert(estimates)
      .values({ projectId, version, createdBy })
      .returning();

    if (!estimate) {
      throw new Error('Failed to create estimate');
    }

    if (items.length > 0) {
      await this.db.insert(estimateItems).values(
        items.map((item) => ({
          estimateId: estimate.id,
          materialId: item.materialId,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity.toString(),
          purchaseQuantity:
            item.purchaseQuantity === null
              ? null
              : item.purchaseQuantity.toString(),
          unitPrice:
            item.unitPrice === null ? null : item.unitPrice.toString(),
          subtotal: item.subtotal === null ? null : item.subtotal.toString(),
          note: item.note,
        })),
      );
    }

    return estimate;
  }

  async findById(estimateId: string) {
    const [estimate] = await this.db
      .select()
      .from(estimates)
      .where(eq(estimates.id, estimateId))
      .limit(1);

    if (!estimate) {
      return null;
    }

    const items = await this.db
      .select()
      .from(estimateItems)
      .where(eq(estimateItems.estimateId, estimate.id));

    return { estimate, items };
  }

  async listByProjectIds(projectIds: string[]) {
    if (projectIds.length === 0) return [];
    return this.db
      .select()
      .from(estimates)
      .where(inArray(estimates.projectId, projectIds))
      .orderBy(desc(estimates.createdAt));
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(estimates)
      .where(eq(estimates.projectId, projectId))
      .orderBy(desc(estimates.version));
  }

  async updateStatus(estimateId: string, status: 'draft' | 'final') {
    const [row] = await this.db
      .update(estimates)
      .set({ status, updatedAt: new Date() })
      .where(eq(estimates.id, estimateId))
      .returning();
    return row ?? null;
  }

  async findItemById(itemId: string) {
    const [item] = await this.db
      .select()
      .from(estimateItems)
      .where(eq(estimateItems.id, itemId))
      .limit(1);
    return item ?? null;
  }

  async updateItem(
    itemId: string,
    patch: Partial<{
      quantity: number;
      purchaseQuantity: number | null;
      unitPrice: number | null;
      subtotal: number | null;
      isOverridden: boolean;
      note: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(estimateItems)
      .set({
        ...(patch.quantity !== undefined
          ? { quantity: patch.quantity.toString() }
          : {}),
        ...(patch.purchaseQuantity !== undefined
          ? {
              purchaseQuantity:
                patch.purchaseQuantity === null
                  ? null
                  : patch.purchaseQuantity.toString(),
            }
          : {}),
        ...(patch.unitPrice !== undefined
          ? {
              unitPrice:
                patch.unitPrice === null ? null : patch.unitPrice.toString(),
            }
          : {}),
        ...(patch.subtotal !== undefined
          ? {
              subtotal:
                patch.subtotal === null ? null : patch.subtotal.toString(),
            }
          : {}),
        ...(patch.isOverridden !== undefined
          ? { isOverridden: patch.isOverridden }
          : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
      })
      .where(eq(estimateItems.id, itemId))
      .returning();
    return updated ?? null;
  }
}
