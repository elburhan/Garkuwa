import { ConflictException, ValidationPipe } from '@nestjs/common';
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
import { AttachmentReviewRateLimitGuard } from '../src/modules/incidents/attachments/security-review/attachment-review-rate-limit.guard.js';
import { AttachmentSecurityReviewService } from '../src/modules/incidents/attachments/security-review/attachment-security-review.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const attachmentId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const expectedUpdatedAt = '2026-07-23T20:45:00.000Z';
const origin = getApiEnvironment().WEB_ORIGIN;
const cookie = 'garkuwa_staff_session=fake-token';
const body = {
  decision: 'AVAILABLE',
  reason: 'Reviewed in the approved isolated environment.',
  expectedUpdatedAt,
};

describe('attachment security-review HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const review = jest.fn(async () => ({
    attachment: {
      id: attachmentId,
      status: 'AVAILABLE',
      availableAt: '2026-07-23T20:46:00.000Z',
      rejectedAt: null,
      updatedAt: '2026-07-23T20:46:00.000Z',
    },
    review: {
      decision: 'AVAILABLE',
      reason: body.reason,
      reviewedAt: '2026-07-23T20:46:00.000Z',
      reviewedBy: { id: actorId, displayName: 'Admin' },
      reviewSource: 'MANUAL',
    },
  }));
  const history = jest.fn(async () => ({ items: [] }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(AttachmentSecurityReviewService)
      .useValue({ review, history })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
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
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    principal = null;
    app.get(AttachmentReviewRateLimitGuard).reset();
  });

  afterAll(async () => app.close());

  function authenticateAs(role: StaffRole, id = actorId) {
    principal = { id, email: 'staff@example.test', name: 'Staff', role };
  }

  function patch(payload: object = body, requestOrigin: string | null = origin) {
    const call = request(app.getHttpServer())
      .patch(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/security-review`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json');
    if (requestOrigin) call.set('Origin', requestOrigin);
    return call.send(payload);
  }

  it('requires authentication, administrator role, trusted origin, and strict JSON', async () => {
    await patch().expect(401);
    for (const role of [StaffRole.EDITOR, StaffRole.ANALYST, StaffRole.MODERATOR]) {
      authenticateAs(role);
      await patch().expect(403);
    }
    authenticateAs(StaffRole.ADMIN);
    await patch(body, null).expect(403);
    await patch(body, 'https://untrusted.example').expect(403);
    await request(app.getHttpServer())
      .patch(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/security-review`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'text/plain')
      .send('not json')
      .expect(415);
  });

  it.each([StaffRole.ADMIN, StaffRole.SUPER_ADMIN])(
    'allows %s and returns no storage or security internals',
    async (role) => {
      authenticateAs(role);
      const response = await patch().expect(200);
      expect(review).toHaveBeenCalledWith(incidentId, attachmentId, body, principal);
      expect(response.text).not.toMatch(/objectKey|sha256|filesystem|password|session|contact/i);
    },
  );

  it('validates UUIDs, decision, reason, timestamp and unknown fields', async () => {
    authenticateAs(StaffRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/admin/incidents/${incidentId}/attachments/not-a-uuid/security-review`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
    await patch({ ...body, decision: 'QUARANTINED' }).expect(400);
    await patch({ ...body, reason: 'short' }).expect(400);
    await patch({ ...body, expectedUpdatedAt: 'yesterday' }).expect(400);
    await patch({ ...body, extra: true }).expect(400);
  });

  it('preserves a safe 409 conflict response', async () => {
    authenticateAs(StaffRole.ADMIN);
    review.mockRejectedValueOnce(
      new ConflictException('The attachment changed and must be refreshed.') as never,
    );
    const response = await patch().expect(409);
    expect(response.text).not.toMatch(/prisma|sql|objectKey|sha256|session/i);
  });

  it('allows incident readers to view history while the service applies reason visibility', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/security-reviews`)
      .set('Cookie', cookie)
      .expect(401);
    authenticateAs(StaffRole.EDITOR);
    await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/security-reviews`)
      .set('Cookie', cookie)
      .expect(403);
    for (const role of [
      StaffRole.SUPER_ADMIN,
      StaffRole.ADMIN,
      StaffRole.MODERATOR,
      StaffRole.ANALYST,
    ]) {
      authenticateAs(role);
      await request(app.getHttpServer())
        .get(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/security-reviews`)
        .set('Cookie', cookie)
        .expect(200);
      expect(history).toHaveBeenLastCalledWith(incidentId, attachmentId, principal);
    }
  });

  it('limits each staff identity independently to 20 attempts per window', async () => {
    authenticateAs(StaffRole.ADMIN);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await patch().expect(200);
    }
    await patch().expect(429);
    authenticateAs(StaffRole.ADMIN, 'a7bb4105-88de-44e7-bd2d-5df263f999ab');
    await patch().expect(200);
  });
});
