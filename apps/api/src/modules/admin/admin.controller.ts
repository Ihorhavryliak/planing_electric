import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthRepository } from '../auth/auth.repository';
import { toPublicUser } from '../auth/auth.mapper';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    @Inject(AuthRepository) private readonly users: AuthRepository,
    @Inject(OrganizationsRepository)
    private readonly organizations: OrganizationsRepository,
  ) {}

  @Get('users')
  async listUsers() {
    const rows = await this.users.listUsers();
    return rows.map(toPublicUser);
  }

  @Get('organizations')
  async listOrganizations() {
    const rows = await this.organizations.listAll();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      settings: row.settings,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}