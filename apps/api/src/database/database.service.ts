import { ConfigService } from '@nestjs/config';
import { createDatabase, type Database, type DatabaseConnection } from '@drawmyplace/database';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly connection: DatabaseConnection;

  readonly db: Database;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.connection = createDatabase(
      config.getOrThrow<string>('DATABASE_URL'),
    );
    this.db = this.connection.db;
  }

  async ping(): Promise<void> {
    await this.connection.client`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection.client.end({ timeout: 5 });
  }
}
