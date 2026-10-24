import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('API_PORT');

  await app.listen(port);
}

void bootstrap();
