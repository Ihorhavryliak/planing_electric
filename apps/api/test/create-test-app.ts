import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.service';
import { createTestDatabase, type TestDatabase } from './test-database';

export interface TestApp {
  app: INestApplication;
  database: TestDatabase;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const database = await createTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DatabaseService)
    .useValue({
      db: database.db,
      ping: async () => {
        await database.client.query('select 1');
      },
      onApplicationShutdown: async () => {},
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    database,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}
