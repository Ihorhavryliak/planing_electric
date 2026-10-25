import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { invitations, organizationMembers, type Database } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class InvitationsRepository {
  private readonly db: Database;
  constructor(@Inject(DatabaseService) database: DatabaseService) {
    this.db = database.db;
  }

  async create(data: {
    organizationId: string;
    email: string;
    role: string;
    tokenHash: string;
    invitedBy: string | null;
    expiresAt: Date;
  }) {
    const [row] = await this.db
      .insert(invitations)
      .values([
        {
          organizationId: data.organizationId,
          email: data.email,
          role: data.role as never,
          tokenHash: data.tokenHash,
          invitedBy: data.invitedBy,
          expiresAt: data.expiresAt,
        },
      ])
      .returning();
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByTokenHash(tokenHash: string) {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async listByOrganization(organizationId: string) {
    return this.db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, organizationId));
  }

  async markAccepted(id: string) {
    const [row] = await this.db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return row ?? null;
  }

  async markRevoked(id: string) {
    const [row] = await this.db
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return row ?? null;
  }

  async addMember(organizationId: string, userId: string, role: string) {
    const [row] = await this.db
      .insert(organizationMembers)
      .values({ organizationId, userId, role: role as never, status: 'active' })
      .returning();
    return row;
  }
}