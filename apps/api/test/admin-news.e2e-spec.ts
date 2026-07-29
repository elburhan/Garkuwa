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
import { NewsService } from '../src/modules/news/news.service.js';

const articleId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const cookie = 'garkuwa_staff_session=fake-token';
const content = {
  categoryCode: 'NEWS',
  titleHa: 'Sanarwar Tsaro ta Gidauniyar Garkuwa',
  summaryHa: 'Wannan taƙaitaccen bayani ne na gwaji domin tabbatar da ingancin tsarin.',
  bodyHa: `Cikakken bayanin gwaji ne. ${'Bayani '.repeat(20)}`,
};

describe('admin news HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const service = {
    list: jest.fn(async () => ({ items: [], pagination: { page: 1, pageSize: 20 } })),
    create: jest.fn(async () => ({ article: { id: articleId, status: 'DRAFT' } })),
    detail: jest.fn(async () => ({ article: { id: articleId, status: 'DRAFT' } })),
    update: jest.fn(async () => ({ article: { id: articleId, status: 'DRAFT' } })),
    transition: jest.fn(async () => ({ article: { id: articleId, status: 'IN_REVIEW' } })),
    history: jest.fn(async () => ({ items: [] })),
    categories: jest.fn(async () => ({
      items: [
        {
          code: 'NEWS',
          slug: 'news',
          nameHa: 'Labarai',
          nameEn: 'News',
          displayOrder: 6,
          isActive: true,
        },
      ],
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(NewsService)
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
    principal = { id: articleId, email: 'staff@example.test', name: 'Staff', role };
  };
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/admin/news${path}`).set('Cookie', cookie);
  const post = () =>
    request(app.getHttpServer())
      .post('/api/admin/news')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/json');

  it('blocks unauthenticated and ANALYST access while allowing editorial readers', async () => {
    await get('/categories').expect(401);
    await get('').expect(401);
    authenticateAs(StaffRole.ANALYST);
    await get('').expect(403);
    await get('/categories').expect(403);
    for (const role of [
      StaffRole.EDITOR,
      StaffRole.MODERATOR,
      StaffRole.ADMIN,
      StaffRole.SUPER_ADMIN,
    ]) {
      authenticateAs(role);
      const response = await get('').expect(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      await get('/categories').expect(200);
    }
  });

  it('allows creators, blocks MODERATOR creation, and requires trusted strict JSON', async () => {
    authenticateAs(StaffRole.MODERATOR);
    await post().send(content).expect(403);
    authenticateAs(StaffRole.EDITOR);
    await request(app.getHttpServer())
      .post('/api/admin/news')
      .set('Cookie', cookie)
      .set('Origin', 'https://untrusted.example')
      .set('Content-Type', 'application/json')
      .send(content)
      .expect(403);
    await post()
      .send({ ...content, unknown: true })
      .expect(400);
    await post().send(content).expect(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ titleHa: content.titleHa }),
      expect.objectContaining({ role: StaffRole.EDITOR }),
    );
  });

  it('validates IDs and exposes detail, update, status, and history without security fields', async () => {
    authenticateAs(StaffRole.ADMIN);
    await get('/invalid').expect(400);
    await get(`/${articleId}`).expect(200);
    await get(`/${articleId}/history`).expect(200);
    const update = await request(app.getHttpServer())
      .patch(`/api/admin/news/${articleId}`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/json')
      .send({ ...content, expectedUpdatedAt: '2026-07-29T10:00:00.000Z' })
      .expect(200);
    expect(update.text).not.toMatch(/password|session|token|failedLogin/i);
    await request(app.getHttpServer())
      .patch(`/api/admin/news/${articleId}/status`)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/json')
      .send({
        decision: 'SUBMIT_FOR_REVIEW',
        expectedUpdatedAt: '2026-07-29T10:00:00.000Z',
      })
      .expect(200);
  });
});
