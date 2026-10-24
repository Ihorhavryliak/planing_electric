import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const SERVICE_NAME = 'drawmyplace-api';
const SERVICE_VERSION = '0.1.0';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  check(): {
    status: 'ok';
    service: string;
    version: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ready';
    database: 'up';
    timestamp: string;
  }> {
    try {
      await this.database.ping();
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'unavailable',
        message: 'Database is unavailable',
      });
    }

    return {
      status: 'ready',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
