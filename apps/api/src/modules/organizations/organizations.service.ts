/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateOrganizationInput,
  PublicOrganization,
  PublicOrganizationMember,
  UpdateOrganizationInput,
  AddOrganizationMemberInput,
  UpdateOrganizationMemberInput,
} from '@drawmyplace/contracts';
import { OrganizationsRepository } from './organizations.repository';

function toPublicOrg(row: any): PublicOrganization {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicMember(row: any): PublicOrganizationMember {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository)
    private readonly repo: OrganizationsRepository,
  ) {}

  async create(userId: string, input: CreateOrganizationInput) {
    const row = await this.repo.create(input.name, userId);
    return toPublicOrg(row);
  }

  async list(userId: string) {
    const rows = await this.repo.listForUser(userId);
    return rows.map(toPublicOrg);
  }

  async get(userId: string, id: string) {
    const row = await this.repo.findById(id);
    if (!row) return null;
    const member = await this.repo.findMember(id, userId);
    if (!member || member.status !== 'active') return null;
    return toPublicOrg(row);
  }

  async update(userId: string, id: string, input: UpdateOrganizationInput) {
    const row = await this.repo.findById(id);
    if (!row) return null;
    const member = await this.repo.findMember(id, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return null;
    }
    const updated = await this.repo.update(id, input);
    return updated ? toPublicOrg(updated) : null;
  }

  async delete(userId: string, id: string) {
    const row = await this.repo.findById(id);
    if (!row || row.ownerId !== userId) return false;
    await this.repo.delete(id);
    return true;
  }

  async listMembers(userId: string, organizationId: string) {
    const member = await this.repo.findMember(organizationId, userId);
    if (!member || member.status !== 'active') return null;
    const rows = await this.repo.listMembers(organizationId);
    return rows.map(toPublicMember);
  }

  async addMember(
    userId: string,
    organizationId: string,
    input: AddOrganizationMemberInput,
  ) {
    const requester = await this.repo.findMember(organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return null;
    }
    const existing = await this.repo.findMember(organizationId, input.userId);
    if (existing) return toPublicMember(existing);
    const row = await this.repo.addMember(
      organizationId,
      input.userId,
      input.role,
    );
    return toPublicMember(row);
  }

  async updateMember(
    userId: string,
    organizationId: string,
    memberId: string,
    input: UpdateOrganizationMemberInput,
  ) {
    const requester = await this.repo.findMember(organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return null;
    }
    const members = await this.repo.listMembers(organizationId);
    const target = members.find((m) => m.id === memberId);
    if (!target) return null;
    const updated = await this.repo.updateMember(memberId, {
      role: input.role,
      status: input.status,
    });
    return updated ? toPublicMember(updated) : null;
  }

  async removeMember(userId: string, organizationId: string, memberId: string) {
    const requester = await this.repo.findMember(organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return false;
    }
    const members = await this.repo.listMembers(organizationId);
    const target = members.find((m) => m.id === memberId);
    if (!target) return false;
    if (target.role === 'owner') return false;
    await this.repo.removeMember(memberId);
    return true;
  }
}