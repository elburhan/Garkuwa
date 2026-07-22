import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { getApiEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = getApiEnvironment();
  const app = await NestFactory.create(AppModule);

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
