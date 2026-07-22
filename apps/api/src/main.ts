import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { getApiEnvironment } from './config/environment.js';
import { configureApiHttpHardening } from './config/http-hardening.js';

async function bootstrap(): Promise<void> {
  const environment = getApiEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  configureApiHttpHardening(app);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: environment.WEB_ORIGIN,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(environment.API_PORT);
  Logger.log(`API listening on port ${environment.API_PORT}`, 'Bootstrap');
}

void bootstrap();
