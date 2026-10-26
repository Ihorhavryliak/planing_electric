import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MailService } from '../../common/mail/mail.service';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  CreateInvitationInput,
  PublicInvitation,
} from '@drawmyplace/contracts';
import { AuthRepository } from '../auth/auth.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { InvitationsRepository } from './invitations.repository';

function toPublic(row: any): PublicInvitation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    role: row.role,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(InvitationsRepository) private readonly repo: InvitationsRepository,
    @Inject(OrganizationsRepository)
    private readonly orgs: OrganizationsRepository,
    @Inject(AuthRepository) private readonly users: AuthRepository,
    @Inject(NotificationsRepository)
    private readonly notifications: NotificationsRepository,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async create(userId: string, organizationId: string, input: CreateInvitationInput) {
    const requester = await this.orgs.findMember(organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return null;
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
    const row = await this.repo.create({
      organizationId,
      email: input.email,
      role: input.role,
      tokenHash,
      invitedBy: userId,
      expiresAt,
    });
    if (!row) {
      throw new Error('Failed to create invitation');
    }

    const existingUser = await this.users.findUserByEmail(input.email);
    if (existingUser) {
      await this.notifications.create(existingUser.id, 'invitation.received', {
        organizationId,
        invitationId: row.id,
        role: input.role,
      });
    }

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? '';
    const link = `${webOrigin}/invite/${rawToken}`;
    await this.mail.send(
      input.email,
      'DrawMyPlace invitation / Запрошення до організації / Приглашение в организацию',
      [
        `You have been invited to join an organization as ${input.role}.`,
        `Вас запрошено приєднатися до організації з роллю ${input.role}.`,
        `Вас пригласили присоединиться к организации с ролью ${input.role}.`,
        '',
        'Accept the invitation:',
        'Прийняти запрошення:',
        'Принять приглашение:',
        '',
        link,
        '',
        `The invitation expires in ${input.expiresInDays} day(s).`,
        `Запрошення дійсне ${input.expiresInDays} дн.`,
        `Приглашение действует ${input.expiresInDays} дн.`,
      ].join('\n'),
    );

    const exposeToken = this.config.get<string>('NODE_ENV') !== 'production';
    return {
      invitation: toPublic(row),
      token: exposeToken ? rawToken : undefined,
    };
  }

  async list(userId: string, organizationId: string) {
    const requester = await this.orgs.findMember(organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return null;
    }
    const rows = await this.repo.listByOrganization(organizationId);
    return rows.map(toPublic);
  }

  async revoke(userId: string, invitationId: string) {
    const invitation = await this.repo.findById(invitationId);
    if (!invitation) return false;
    const requester = await this.orgs.findMember(invitation.organizationId, userId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return false;
    }
    await this.repo.markRevoked(invitationId);
    return true;
  }

  async accept(userId: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await this.repo.findByTokenHash(tokenHash);
    if (!invitation) return null;
    if (invitation.revokedAt || invitation.acceptedAt) return null;
    if (new Date() > invitation.expiresAt) return null;
    const user = await this.users.findUserByEmail(invitation.email);
    // allow any logged-in user? require email match ideally
    if (user && user.id !== userId) {
      // email mismatch; still allow? For MVP, allow if email matches
      return null;
    }
    await this.repo.markAccepted(invitation.id);
    await this.repo.addMember(invitation.organizationId, userId, invitation.role);
    return toPublic(invitation);
  }
}