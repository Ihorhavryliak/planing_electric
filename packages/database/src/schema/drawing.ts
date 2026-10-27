import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { floors, projects } from './projects';
import { organizations, users } from './identity';
import {
  electricalPointTypeEnum,
  estimateStatusEnum,
  estimateTypeEnum,
  openingTypeEnum,
} from './enums';
import type { CalculationSettings, Point2D } from './types';

export const materials = pgTable(
  'materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(
      () => organizations.id,
      { onDelete: 'cascade' },
    ),
    code: text('code').notNull(),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('m'),
    category: text('category'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
    currency: text('currency').notNull().default('UAH'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('materials_org_code_unique').on(
      table.organizationId,
      table.code,
    ),
    index('materials_organization_idx').on(table.organizationId),
  ],
);

export const walls = pgTable(
  'walls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    geometry: jsonb('geometry').$type<Point2D[]>().notNull(),
    /** Wall thickness in drawing units; null means "not specified". */
    thickness: doublePrecision('thickness'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('walls_floor_idx').on(table.floorId)],
);

export const openings = pgTable(
  'openings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    wallId: uuid('wall_id')
      .notNull()
      .references(() => walls.id, { onDelete: 'cascade' }),
    type: openingTypeEnum('type').notNull(),
    /** Distance from the wall start to the opening start, drawing units. */
    offset: doublePrecision('offset').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull().default(210),
    sillHeight: doublePrecision('sill_height').notNull().default(0),
    flipped: boolean('flipped').notNull().default(false),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('openings_floor_idx').on(table.floorId),
    index('openings_wall_idx').on(table.wallId),
  ],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    boundary: jsonb('boundary').$type<Point2D[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('rooms_floor_idx').on(table.floorId)],
);

export const dimensions = pgTable(
  'dimensions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    pointA: jsonb('point_a').$type<Point2D>().notNull(),
    pointB: jsonb('point_b').$type<Point2D>().notNull(),
    /** Perpendicular offset of the dimension line from the measured points. */
    offset: doublePrecision('offset').notNull().default(0),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('dimensions_floor_idx').on(table.floorId)],
);

export const electricalPoints = pgTable(
  'electrical_points',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    type: electricalPointTypeEnum('type').notNull().default('socket'),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    rotation: doublePrecision('rotation').notNull().default(0),
    label: text('label'),
    mountingHeight: doublePrecision('mounting_height'),
    properties: jsonb('properties')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('electrical_points_floor_idx').on(table.floorId),
    index('electrical_points_type_idx').on(table.type),
  ],
);

export const cableRoutes = pgTable(
  'cable_routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    floorId: uuid('floor_id')
      .notNull()
      .references(() => floors.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id').references(() => materials.id, {
      onDelete: 'set null',
    }),
    circuitId: text('circuit_id'),
    startPointId: uuid('start_point_id').references(
      () => electricalPoints.id,
      { onDelete: 'set null' },
    ),
    endPointId: uuid('end_point_id').references(
      () => electricalPoints.id,
      { onDelete: 'set null' },
    ),
    geometry: jsonb('geometry').$type<Point2D[]>().notNull(),
    settings: jsonb('settings')
      .$type<CalculationSettings>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('cable_routes_floor_idx').on(table.floorId),
    index('cable_routes_material_idx').on(table.materialId),
  ],
);

export const estimates = pgTable(
  'estimates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    status: estimateStatusEnum('status').notNull().default('draft'),
    type: estimateTypeEnum('type').notNull().default('power'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    calculationSettings: jsonb('calculation_settings')
      .$type<CalculationSettings>()
      .notNull()
      .default({}),
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('estimates_project_version_unique').on(
      table.projectId,
      table.version,
    ),
  ],
);

export const estimateItems = pgTable(
  'estimate_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    estimateId: uuid('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id').references(() => materials.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    unit: text('unit').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    purchaseQuantity: numeric('purchase_quantity', {
      precision: 12,
      scale: 3,
    }),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
    subtotal: numeric('subtotal', { precision: 14, scale: 2 }),
    isOverridden: boolean('is_overridden').notNull().default(false),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('estimate_items_estimate_idx').on(table.estimateId)],
);
