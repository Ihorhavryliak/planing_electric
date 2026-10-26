import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { initErrorReporting } from './common/observability/sentry';

async function bootstrap(): Promise<void> {
  initErrorReporting(process.env.SENTRY_DSN);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('API_PORT');

  await app.listen(port);
}

void bootstrap();
