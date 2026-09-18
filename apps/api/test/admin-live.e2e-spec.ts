import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';
import { LiveService } from '../src/modules/live/live.service.js';

const eventId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const updateId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const cookie = 'garkuwa_staff_session=fake-token';

describe('admin live HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const service = {
    list: jest.fn(async () => ({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
    })),
    create: jest.fn(async () => ({ event: { id: eventId, status: 'DRAFT' } })),
    detail: jest.fn(async () => ({ event: { id: eventId, status: 'ACTIVE' }, updates: [] })),
    updateMetadata: jest.fn(async () => ({ event: { id: eventId, status: 'ACTIVE' } })),
    updatePublishing: jest.fn(async () => ({ event: { id: eventId, status: 'CLOSED' } })),
    addUpdate: jest.fn(async () => ({ update: { id: updateId, sequence: 1 } })),
    pinUpdate: jest.fn(async () => ({ update: { id: updateId, isPinned: true } })),
    correctUpdate: jest.fn(async () => ({
      update: { id: updateId, correctedAt: new Date().toISOString() },
    })),
    withdrawUpdate: jest.fn(async () => ({ update: { id: updateId, isWithdrawn: true } })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(LiveService)
      .useValue(service)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    principal = null;
  });
  afterAll(async () => app.close());

  const authenticateAs = (role: StaffRole) => {
    principal = { id: eventId, email: 'staff@example.test', name: 'Staff', role };
  };
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/admin/live${path}`).set('Cookie', cookie);
  const jsonRequest = (method: 'post' | 'patch', path: string) =>
    request(app.getHttpServer())
      [method](`/api/admin/live${path}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/json');

  it('blocks unauthenticated and ANALYST access while allowing editorial readers', async () => {
    await get('').expect(401);
    authenticateAs(StaffRole.ANALYST);
    await get('').expect(403);
    for (const role of [
      StaffRole.EDITOR,
      StaffRole.MODERATOR,
      StaffRole.ADMIN,
      StaffRole.SUPER_ADMIN,
    ]) {
      authenticateAs(role);
      await get('').expect(200);
    }
  });

  it('lets EDITOR create events but blocks MODERATOR, and requires trusted origin', async () => {
    const body = {
      categoryCode: 'NEWS',
      titleHa: 'Gwajin lamari',
      titleEn: null,
      summaryHa: null,
      summaryEn: null,
    };
    authenticateAs(StaffRole.MODERATOR);
    await jsonRequest('post', '').send(body).expect(403);
    authenticateAs(StaffRole.EDITOR);
    await request(app.getHttpServer())
      .post('/api/admin/live')
      .set('Cookie', cookie)
      .set('Origin', 'https://untrusted.example')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(403);
    await jsonRequest('post', '').send(body).expect(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ titleHa: 'Gwajin lamari' }),
      expect.objectContaining({ role: StaffRole.EDITOR }),
    );
  });

  it('lets EDITOR/MODERATOR post updates but reserves publishing to LIVE_PUBLISH holders', async () => {
    authenticateAs(StaffRole.EDITOR);
    await jsonRequest('post', `/${eventId}/updates`)
      .send({ bodyHa: 'Sabuntawa', clientSubmissionId: updateId })
      .expect(201);
    await jsonRequest('patch', `/${eventId}/publishing`)
      .send({ action: 'CLOSE', isFeatured: false, expectedUpdatedAt: '2026-09-17T10:00:00.000Z' })
      .expect(403);
    authenticateAs(StaffRole.MODERATOR);
    await jsonRequest('post', `/${eventId}/updates`)
      .send({ bodyHa: 'Sabuntawa', clientSubmissionId: updateId })
      .expect(201);
    await jsonRequest('patch', `/${eventId}/publishing`)
      .send({ action: 'CLOSE', isFeatured: false, expectedUpdatedAt: '2026-09-17T10:00:00.000Z' })
      .expect(200);
  });

  it('validates IDs and supports reasoned withdrawal', async () => {
    authenticateAs(StaffRole.MODERATOR);
    await get('/invalid').expect(400);
    await get(`/${eventId}`).expect(200);
    await jsonRequest('patch', `/${eventId}/updates/${updateId}/withdraw`)
      .send({
        reason: 'This update was superseded by verified information.',
        expectedUpdatedAt: '2026-09-17T10:00:00.000Z',
      })
      .expect(200);
    expect(service.withdrawUpdate).toHaveBeenCalledWith(
      eventId,
      updateId,
      expect.objectContaining({ reason: expect.any(String) }),
      expect.objectContaining({ role: StaffRole.MODERATOR }),
    );
  });
});
