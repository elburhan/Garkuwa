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
import { IncidentStaffNotesService } from '../src/modules/incidents/staff-notes/incident-staff-notes.service.js';
import { StaffNoteRateLimitGuard } from '../src/modules/incidents/staff-notes/staff-note-rate-limit.guard.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const noteId = 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0';
const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const origin = getApiEnvironment().WEB_ORIGIN;
const cookie = 'garkuwa_staff_session=fake-token';

describe('incident staff-note HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const note = {
    id: noteId,
    body: 'Internal note',
    version: 1,
    createdAt: '2026-07-23T14:00:00.000Z',
    updatedAt: '2026-07-23T14:00:00.000Z',
    editedAt: null,
    author: { id: actorId, displayName: 'Staff member' },
    isDeleted: false,
  };
  const create = jest.fn(async () => ({ note }));
  const list = jest.fn(async () => ({
    items: [note],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  }));
  const edit = jest.fn(async () => ({ note: { ...note, body: 'Corrected', version: 2 } }));
  const redact = jest.fn(async () => ({
    note: { id: noteId, isDeleted: true, deletedAt: '2026-07-23T14:10:00.000Z' },
  }));
  const revisions = jest.fn(async () => ({ items: [] }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(IncidentStaffNotesService)
      .useValue({ create, list, edit, redact, revisions })
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
    app.get(StaffNoteRateLimitGuard).reset();
  });
  afterAll(async () => app.close());

  const setPrincipal = (role: StaffRole) => {
    principal = { id: actorId, email: 'staff@example.test', name: 'Staff', role };
  };
  const post = (path: string, body: object, requestOrigin = origin) =>
    request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookie)
      .set('Origin', requestOrigin)
      .set('Content-Type', 'application/json')
      .send(body);

  it('blocks unauthenticated and EDITOR note reads', async () => {
    await request(app.getHttpServer()).get(`/api/admin/incidents/${incidentId}/notes`).expect(401);
    setPrincipal(StaffRole.EDITOR);
    await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/notes`)
      .set('Cookie', cookie)
      .expect(403);
    await post(`/api/admin/incidents/${incidentId}/notes`, { body: 'Internal note' }).expect(403);
  });

  it.each([StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR, StaffRole.ANALYST])(
    'allows %s to read notes',
    async (role) => {
      setPrincipal(role);
      await request(app.getHttpServer())
        .get(`/api/admin/incidents/${incidentId}/notes`)
        .set('Cookie', cookie)
        .expect(200);
    },
  );

  it.each([StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.MODERATOR])(
    'allows %s to create notes',
    async (role) => {
      setPrincipal(role);
      await post(`/api/admin/incidents/${incidentId}/notes`, { body: '  Internal note  ' }).expect(
        201,
      );
      expect(create).toHaveBeenCalledWith(incidentId, { body: 'Internal note' }, principal);
    },
  );

  it('blocks ANALYST creation, MODERATOR redaction, and untrusted origins', async () => {
    setPrincipal(StaffRole.ANALYST);
    await post(`/api/admin/incidents/${incidentId}/notes`, { body: 'Internal note' }).expect(403);
    setPrincipal(StaffRole.MODERATOR);
    await post(`/api/admin/incidents/${incidentId}/notes/${noteId}/redact`, {
      reason: 'Administrative redaction reason.',
      expectedVersion: 1,
    }).expect(403);
    setPrincipal(StaffRole.ADMIN);
    await post(
      `/api/admin/incidents/${incidentId}/notes`,
      { body: 'Internal note' },
      'https://untrusted.example',
    ).expect(403);
  });

  it('allows administrators to redact and view revisions', async () => {
    for (const role of [StaffRole.ADMIN, StaffRole.SUPER_ADMIN]) {
      setPrincipal(role);
      await post(`/api/admin/incidents/${incidentId}/notes/${noteId}/redact`, {
        reason: 'Administrative redaction reason.',
        expectedVersion: 1,
      }).expect(201);
      await request(app.getHttpServer())
        .get(`/api/admin/incidents/${incidentId}/notes/${noteId}/revisions`)
        .set('Cookie', cookie)
        .expect(200);
    }
    setPrincipal(StaffRole.MODERATOR);
    await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}/notes/${noteId}/revisions`)
      .set('Cookie', cookie)
      .expect(403);
  });

  it('allows a moderator edit request and forwards the strict optimistic version', async () => {
    setPrincipal(StaffRole.MODERATOR);
    await request(app.getHttpServer())
      .patch(`/api/admin/incidents/${incidentId}/notes/${noteId}`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send({ body: 'Corrected note', expectedVersion: 1 })
      .expect(200);
    expect(edit).toHaveBeenCalledWith(
      incidentId,
      noteId,
      { body: 'Corrected note', expectedVersion: 1 },
      principal,
    );
  });

  it('returns a safe 429 after 30 mutations for one staff actor', async () => {
    setPrincipal(StaffRole.MODERATOR);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await post(`/api/admin/incidents/${incidentId}/notes`, { body: 'Internal note' }).expect(201);
    }
    const response = await post(`/api/admin/incidents/${incidentId}/notes`, {
      body: 'Internal note',
    }).expect(429);
    expect(response.body).not.toHaveProperty('body');
    expect(response.body).not.toHaveProperty('incidentId');
    expect(response.body).not.toHaveProperty('noteId');
  });

  it('leaves the ordinary health endpoint unaffected', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('rejects invalid UUIDs and unknown fields', async () => {
    setPrincipal(StaffRole.ADMIN);
    await post('/api/admin/incidents/not-a-uuid/notes', { body: 'Internal note' }).expect(400);
    await post(`/api/admin/incidents/${incidentId}/notes`, {
      body: 'Internal note',
      unknown: true,
    }).expect(400);
  });
});
