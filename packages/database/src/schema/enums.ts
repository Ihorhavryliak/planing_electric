import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled']);

export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'manager',
  'electrician',
  'viewer',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'invited',
  'suspended',
]);

export const projectRoleEnum = pgEnum('project_role', [
  'owner',
  'manager',
  'electrician',
  'viewer',
]);

export const projectStatusEnum = pgEnum('project_status', ['active', 'archived']);

export const planSourceTypeEnum = pgEnum('plan_source_type', ['blank', 'upload']);

export const electricalPointTypeEnum = pgEnum('electrical_point_type', [
  'socket',
  'switch',
  'light',
  'panel',
  'junction',
  'custom',
]);

export const estimateStatusEnum = pgEnum('estimate_status', ['draft', 'final']);

export const openingTypeEnum = pgEnum('opening_type', ['door', 'window']);
