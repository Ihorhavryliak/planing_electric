import { PGlite } from '@electric-sql/pglite';
import * as schema from '@drawmyplace/database';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';

const migrationsFolder = fileURLToPath(
  new URL('../../../packages/database/migrations', import.meta.url),
);

export interface TestDatabase {
  db: PgliteDatabase<typeof schema>;
  client: PGlite;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder });

  return {
    db,
    client,
    close: () => client.close(),
  };
}
