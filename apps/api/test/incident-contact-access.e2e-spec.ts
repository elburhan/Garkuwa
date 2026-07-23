import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { getApiEnvironment } from '../src/config/environment.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';
import { ContactAccessRateLimitGuard } from '../src/modules/incidents/contact-access/contact-access-rate-limit.guard.js';
import { IncidentContactAccessService } from '../src/modules/incidents/contact-access/incident-contact-access.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const cookie = 'garkuwa_staff_session=fake-opaque-token';
const origin = getApiEnvironment().WEB_ORIGIN;
const principalFor = (role: StaffRole): StaffPrincipal => ({
  id: actorId,
  email: 'staff@example.test',
  name: 'Staff member',
  role,
});

describe('restricted contact access HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const reveal = jest.fn(async () => ({
    contact: {
      name: 'Fake Person',
      phone: '+2340000000000',
      email: null,
      preferredContactMethod: 'PHONE',
      safeContactInstructions: null,
      consentToContact: true,
    },
    access: { accessedAt: '2026-07-23T14:00:00.000Z' },
  }));
  const history = jest.fn(async () => ({
    items: [
      {
        id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
        reason: 'Required for approved follow-up.',
        accessedAt: '2026-07-23T14:00:00.000Z',
        accessedBy: { id: actorId, displayName: 'Staff member' },
      },
    ],
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(IncidentContactAccessService)
      .useValue({ reveal, history })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    principal = null;
    app.get(ContactAccessRateLimitGuard).reset();
  });

  afterAll(async () => app.close());

  function post(body: object, requestOrigin = origin) {
    return request(app.getHttpServer())
      .post(`/api/admin/incidents/${incidentId}/contact-access`)
      .set('Cookie', cookie)
      .set('Origin', requestOrigin)
      .set('Content-Type', 'application/json')
      .send(body);
  }

  it('returns 401 without a valid staff session', async () => {
    await post({ reason: 'Required for approved follow-up.' }).expect(401);
  });

  it.each([StaffRole.EDITOR, StaffRole.ANALYST, StaffRole.MODERATOR])(
    'returns 403 for %s without revealing contact existence',
    async (role) => {
      principal = principalFor(role);
      const response = await post({ reason: 'Required for approved follow-up.' }).expect(403);
      expect(response.text).not.toMatch(/contact information is available|Fake Person/i);
    },
  );

  it.each([StaffRole.ADMIN, StaffRole.SUPER_ADMIN])(
    'allows %s and returns only approved fields',
    async (role) => {
      principal = principalFor(role);
      const response = await post({ reason: '  Required for approved follow-up.  ' }).expect(201);
      expect(reveal).toHaveBeenCalledWith(
        incidentId,
        { reason: 'Required for approved follow-up.' },
        principal,
      );
      expect(response.body).toHaveProperty('contact.phone');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toMatch(/contactId|cipher|token|cookie|password/i);
    },
  );

  it('requires strict JSON, trusted origin, valid UUID, and a bounded reason', async () => {
    principal = principalFor(StaffRole.ADMIN);
    await post({ reason: 'Required for approved follow-up.' }, 'https://untrusted.example').expect(
      403,
    );
    await post({ reason: 'short' }).expect(400);
    await post({ reason: 'Required approved reason', unexpected: true }).expect(400);
    await request(app.getHttpServer())
      .post('/api/admin/incidents/not-a-uuid/contact-access')
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Required for approved follow-up.' })
      .expect(400);
  });

  it('rate limits reveal attempts per staff identity', async () => {
    principal = principalFor(StaffRole.ADMIN);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await post({ reason: 'Required for approved follow-up.' }).expect(201);
    }
    const response = await post({ reason: 'Required for approved follow-up.' }).expect(429);
    expect(response.text).not.toMatch(/Fake Person|contactId|cipher/i);
  });

  it('restricts contact-access history to administrators and returns no contact values', async () => {
    principal = principalFor(StaffRole.MODERATOR);
    await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/contact-access-history`)
      .set('Cookie', cookie)
      .expect(403);

    principal = principalFor(StaffRole.ADMIN);
    const response = await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/contact-access-history`)
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual(await history());
    expect(response.text).not.toMatch(/phone|email|cipher|token|password/i);
  });
});
