import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';
import { LiveService } from '../src/modules/live/live.service.js';

describe('public live HTTP endpoints', () => {
  let app: NestExpressApplication;
  const service = {
    publicList: jest.fn(async () => ({
      generatedAt: '2026-09-17T10:00:00.000Z',
      items: [
        {
          slug: 'gwajin-lamari',
          title: 'Gwajin lamari',
          summary: null,
          status: 'ACTIVE',
          isFeatured: false,
          hasEnglishTranslation: false,
          startedAt: '2026-09-17T09:00:00.000Z',
          closedAt: null,
          updatedAt: '2026-09-17T09:30:00.000Z',
          latestUpdateAt: '2026-09-17T09:30:00.000Z',
          updateCount: 2,
          category: { slug: 'news', name: 'Labarai' },
          featuredMedia: null,
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })),
    publicDetail: jest.fn(async () => ({
      slug: 'gwajin-lamari',
      title: 'Gwajin lamari',
      summary: null,
      status: 'ACTIVE',
      isFeatured: false,
      hasEnglishTranslation: false,
      startedAt: '2026-09-17T09:00:00.000Z',
      closedAt: null,
      updatedAt: '2026-09-17T09:30:00.000Z',
      latestUpdateAt: '2026-09-17T09:30:00.000Z',
      updateCount: 1,
      category: { slug: 'news', name: 'Labarai' },
      featuredMedia: null,
      updates: [
        {
          id: 'a1',
          sequence: 1,
          headline: null,
          body: 'Sabuntawa ta farko',
          isPinned: false,
          isWithdrawn: false,
          createdAt: '2026-09-17T09:30:00.000Z',
          updatedAt: '2026-09-17T09:30:00.000Z',
          correctedAt: null,
          media: null,
        },
      ],
      latestSequence: 1,
      oldestSequence: 1,
      hasOlder: false,
    })),
    publicUpdates: jest.fn(async () => ({
      generatedAt: '2026-09-17T09:31:00.000Z',
      updates: [],
      latestSequence: 1,
      hasMore: false,
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate: jest.fn(), revoke: jest.fn() })
      .overrideProvider(LiveService)
      .useValue(service)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('lists live events without requiring authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/public/live').expect(200);
    expect(response.headers['cache-control']).toMatch(/public/);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe('gwajin-lamari');
  });

  it('returns a single live event with ordered updates and no internal fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/live/gwajin-lamari')
      .expect(200);
    expect(response.text).not.toMatch(/createdById|storageKey|password/i);
    expect(response.body.updates[0].body).toBe('Sabuntawa ta farko');
  });

  it('exposes a bounded incremental endpoint with language and cursor validation', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/public/live/gwajin-lamari/updates?lang=en&afterSequence=1&changedAfter=2026-09-17T09:30:00.000Z&limit=20',
      )
      .expect(200);
    expect(response.headers['cache-control']).toMatch(/public/);
    expect(service.publicUpdates).toHaveBeenCalledWith(
      'gwajin-lamari',
      'en',
      1,
      20,
      '2026-09-17T09:30:00.000Z',
    );
    await request(app.getHttpServer())
      .get('/api/public/live/gwajin-lamari/updates?afterSequence=-1')
      .expect(400);
  });
});
