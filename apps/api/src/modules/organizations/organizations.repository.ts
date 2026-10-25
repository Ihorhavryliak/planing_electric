import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  organizations,
  organizationMembers,
  type Database,
} from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OrganizationsRepository {
  private readonly db: Database;
  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async create(name: string, ownerId: string) {
    const [row] = await this.db
      .insert(organizations)
      .values({ name, ownerId })
      .returning();
    if (!row) throw new Error('Failed to create organization');
    // owner membership
    await this.db.insert(organizationMembers).values({
      organizationId: row.id,
      userId: ownerId,
      role: 'owner',
      status: 'active',
    });
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return row ?? null;
  }

  async listAll() {
    return this.db.select().from(organizations);
  }

  async listForUser(userId: string) {
    const memberships = await this.db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'active'),
        ),
      );
    const ids = memberships.map((m) => m.organizationId);
    if (ids.length === 0) return [];
    // fetch orgs
    const rows = await this.db.select().from(organizations);
    return rows.filter((r) => ids.includes(r.id));
  }

  async update(id: string, patch: { name?: string }) {
    const [row] = await this.db
      .update(organizations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string) {
    await this.db.delete(organizations).where(eq(organizations.id, id));
  }

  async listMembers(organizationId: string) {
    return this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  async findMember(organizationId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async addMember(organizationId: string, userId: string, role: string) {
    const [row] = await this.db
      .insert(organizationMembers)
      .values({ organizationId, userId, role: role as never, status: 'active' })
      .returning();
    return row;
  }

  async updateMember(
    memberId: string,
    patch: { role?: string; status?: string },
  ) {
    const [row] = await this.db
      .update(organizationMembers)
      .set({
        ...(patch.role ? { role: patch.role as never } : {}),
        ...(patch.status ? { status: patch.status as never } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    return row ?? null;
  }

  async removeMember(memberId: string) {
    await this.db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, memberId));
  }
}