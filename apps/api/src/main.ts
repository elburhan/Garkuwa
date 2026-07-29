import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import type { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';

import { AppModule } from './app.module.js';
import { getApiEnvironment } from './config/environment.js';
import { configureApiCors, configureApiHttpHardening } from './config/http-hardening.js';
import { SafeHttpExceptionFilter } from './config/safe-http-exception.filter.js';
import { HealthService } from './health/health.service.js';

function enabledLogLevels(minimum: string): LogLevel[] {
  const ordered: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];
  return ordered.slice(0, ordered.indexOf(minimum as LogLevel) + 1);
}

async function bootstrap(): Promise<void> {
  let app: NestExpressApplication | undefined;
  try {
    const environment = getApiEnvironment();
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
      logger: new ConsoleLogger({
        json: environment.NODE_ENV === 'production',
        logLevels: enabledLogLevels(environment.LOG_LEVEL),
      }),
    });

    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    app.useGlobalFilters(new SafeHttpExceptionFilter());
    configureApiCors(app, environment.WEB_ORIGIN);
    app.enableShutdownHooks(['SIGINT', 'SIGTERM']);

    const server = app.getHttpServer() as Server;
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        const deadline = setTimeout(() => {
          server.closeAllConnections();
        }, environment.SHUTDOWN_GRACE_PERIOD_MS);
        deadline.unref();
      });
    }

    await app.init();
    await app.get(HealthService).initialize();
    await app.listen(environment.API_PORT);
    Logger.log(`API listening on port ${environment.API_PORT}`, 'Bootstrap');
  } catch {
    Logger.error(
      'API startup failed because configuration or a required dependency is unavailable.',
      'Bootstrap',
    );
    await app?.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

void bootstrap();
