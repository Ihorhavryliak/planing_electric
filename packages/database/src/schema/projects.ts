import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations, users } from './identity';
import {
  planSourceTypeEnum,
  projectRoleEnum,
  projectStatusEnum,
} from './enums';
import type { EditorViewport, Point2D, UnderlaySettings } from './types';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(
      () => organizations.id,
      { onDelete: 'cascade' },
    ),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('active'),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('projects_organization_idx').on(table.organizationId),
    index('projects_created_by_idx').on(table.createdBy),
    index('projects_status_idx').on(table.status),
  ],
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('project_members_project_user_unique').on(
      table.projectId,
      table.userId,
    ),
    index('project_members_user_idx').on(table.userId),
  ],
);

export const floors = pgTable(
  'floors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('floors_project_idx').on(table.projectId)],
);

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    sourceType: planSourceTypeEnum('source_type').notNull(),
    fileKey: text('file_key'),
    mimeType: text('mime_type'),
    page: integer('page'),
    previewKey: text('preview_key'),
    underlay: jsonb('underlay')
      .$type<UnderlaySettings>()
      .notNull()
      .default({}),
    viewport: jsonb('viewport')
      .$type<EditorViewport>()
      .notNull()
      .default({ x: 0, y: 0, zoom: 1 }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('plans_floor_idx').on(table.floorId)],
);

export const calibrations = pgTable(
  'calibrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    pointA: jsonb('point_a').$type<Point2D>().notNull(),
    pointB: jsonb('point_b').$type<Point2D>().notNull(),
    knownDistance: doublePrecision('known_distance').notNull(),
    unit: text('unit').notNull().default('m'),
    metersPerPixel: doublePrecision('meters_per_pixel').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('calibrations_plan_unique').on(table.planId)],
);
