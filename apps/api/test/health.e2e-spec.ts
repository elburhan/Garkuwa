import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { jest } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiCors, configureApiHttpHardening } from '../src/config/http-hardening.js';
import { SafeHttpExceptionFilter } from '../src/config/safe-http-exception.filter.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { HealthService } from '../src/health/health.service.js';
import { INCIDENT_OBJECT_STORAGE } from '../src/modules/incidents/attachments/incident-object-storage.js';

describe('Health endpoints', () => {
  let app: INestApplication;
  const database = {
    $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([{ '?column?': 1 }]),
  };
  const storage = {
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    checkHealth: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database)
      .overrideProvider(INCIDENT_OBJECT_STORAGE)
      .useValue(storage)
      .compile();

    app = moduleRef.createNestApplication();
    configureApiHttpHardening(app as NestExpressApplication);
    configureApiCors(app as NestExpressApplication, 'http://localhost:3000');
    app.useGlobalFilters(new SafeHttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the compatibility health response process-only', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'garkuwa-api',
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp as string))).toBe(false);
  });

  it('reports liveness without dependency checks', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns 503 readiness until startup dependency checks complete', async () => {
    const unavailable = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
    expect(unavailable.body).toMatchObject({
      statusCode: 503,
      message: 'The API is not ready to receive traffic.',
    });

    await app.get(HealthService).initialize();
    const ready = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(ready.body).toMatchObject({
      status: 'ready',
      checks: { database: 'ok', privateObjectStorage: 'ok' },
    });
  });

  it('accepts only a bounded safe request ID and returns security headers', async () => {
    const supplied = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('X-Request-Id', 'release-check-123')
      .expect(200);
    expect(supplied.headers['x-request-id']).toBe('release-check-123');
    expect(supplied.headers['x-content-type-options']).toBe('nosniff');
    expect(supplied.headers['x-frame-options']).toBe('DENY');

    const replaced = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('X-Request-Id', 'unsafe id with spaces')
      .expect(200);
    expect(replaced.headers['x-request-id']).not.toBe('unsafe id with spaces');
  });

  it('allows only the exact configured credentialed CORS origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('Origin', 'https://untrusted.example.invalid')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
