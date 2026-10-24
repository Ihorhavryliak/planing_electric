import {
  drizzle,
  type PostgresJsDatabase,
} from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  client: Sql;
}

export function createDatabase(connectionString: string): DatabaseConnection {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });

  return { db, client };
}

export * from './schema';
