import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../bootstrap';
import { DatabaseService } from '../../database/database.service';

describe('API health and error handling', () => {
  let app: INestApplication;
  const ping = vi.fn();

  beforeAll(async () => {
    ping.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        ping,
        onApplicationShutdown: vi.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'drawmyplace-api',
      version: '0.1.0',
    });
  });

  it('returns readiness status when the database responds', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      database: 'up',
    });
  });

  it('returns 503 with an actionable message when the database is down', async () => {
    ping.mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Database is unavailable',
    });
  });

  it('normalizes unknown routes into a consistent error body', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/unknown')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/v1/unknown',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('includes security headers from helmet', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
