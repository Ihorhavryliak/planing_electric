import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Admin-managed starter projects. The drawing payload is a complete
 * `templatePlanPayloadSchema`; the API never exposes it on the catalog.
 */
export const projectTemplates = pgTable(
  'project_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: jsonb('name').$type<Record<string, string>>().notNull(),
    description: jsonb('description').$type<Record<string, string>>().notNull(),
    previewSvg: text('preview_svg').notNull(),
    planPayload: jsonb('plan_payload')
      .$type<Record<string, unknown>>()
      .notNull(),
    isPublic: boolean('is_public').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('project_templates_code_unique').on(table.code),
    index('project_templates_public_idx').on(table.isPublic),
  ],
);
