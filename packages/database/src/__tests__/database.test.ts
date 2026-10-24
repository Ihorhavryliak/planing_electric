import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';

const migrationsFolder = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

describe('database migrations and schema', () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    await client.close();
  });

  it('applies migrations and persists a user', async () => {
    const email = `user-${Date.now()}@example.com`;
    const [created] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash: 'test-hash',
        name: 'Test User',
      })
      .returning();

    expect(created?.email).toBe(email);

    const found = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));

    expect(found).toHaveLength(1);
  });

  it('enforces unique user emails', async () => {
    const email = `duplicate-${Date.now()}@example.com`;

    await db.insert(schema.users).values({
      email,
      passwordHash: 'first-hash',
      name: 'First User',
    });

    await expect(
      db.insert(schema.users).values({
        email,
        passwordHash: 'second-hash',
        name: 'Second User',
      }),
    ).rejects.toThrow();
  });
});
