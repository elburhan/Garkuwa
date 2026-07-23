import { Readable } from 'node:stream';

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
import { IncidentAttachmentsService } from '../src/modules/incidents/attachments/incident-attachments.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const attachmentId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';

describe('admin incident attachment HTTP access', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const list = jest.fn(async () => ({ items: [] }));
  const content = jest.fn(async () => ({
    stream: Readable.from(Buffer.from('safe bytes')),
    contentLength: 10,
    contentType: 'application/pdf',
    filename: 'evidence.pdf',
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(IncidentAttachmentsService)
      .useValue({ list, content })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    principal = null;
  });
  afterAll(async () => app.close());

  const authenticateAs = (role: StaffRole) => {
    principal = { id: attachmentId, email: 'staff@example.test', name: 'Staff', role };
  };
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', 'garkuwa_staff_session=fake-token');

  it('blocks unauthenticated and EDITOR metadata while allowing incident viewers', async () => {
    await get(`/api/admin/incidents/${incidentId}/attachments`).expect(401);
    authenticateAs(StaffRole.EDITOR);
    await get(`/api/admin/incidents/${incidentId}/attachments`).expect(403);
    for (const role of [
      StaffRole.SUPER_ADMIN,
      StaffRole.ADMIN,
      StaffRole.MODERATOR,
      StaffRole.ANALYST,
    ]) {
      authenticateAs(role);
      await get(`/api/admin/incidents/${incidentId}/attachments`).expect(200);
    }
  });

  it('blocks ANALYST content and permits available-content roles with hardened headers', async () => {
    authenticateAs(StaffRole.ANALYST);
    await get(`/api/admin/incidents/${incidentId}/attachments/${attachmentId}/content`).expect(403);
    for (const role of [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR]) {
      authenticateAs(role);
      const response = await get(
        `/api/admin/incidents/${incidentId}/attachments/${attachmentId}/content`,
      ).expect(200);
      expect(response.headers).toMatchObject({
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'content-disposition': 'attachment; filename="evidence.pdf"',
      });
    }
  });
});
