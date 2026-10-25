import { z } from 'zod';

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);

export const createInvitationSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['owner', 'admin', 'manager', 'electrician', 'viewer']).default('viewer'),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const publicInvitationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'manager', 'electrician', 'viewer']),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;