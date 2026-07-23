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
import { IncidentWorkflowService } from '../src/modules/incidents/workflow/incident-workflow.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const assigneeId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const expectedUpdatedAt = '2026-07-23T12:00:00.000Z';
const cookie = 'garkuwa_staff_session=fake-opaque-token';
const origin = getApiEnvironment().WEB_ORIGIN;
const principalFor = (role: StaffRole): StaffPrincipal => ({
  id: assigneeId,
  email: 'staff@example.test',
  name: 'Staff member',
  role,
});

describe('incident workflow HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const updateStatus = jest.fn(async () => ({
    incident: {
      id: incidentId,
      internalCaseId: 'GAR-20260723-0001',
      status: 'UNDER_REVIEW',
      updatedAt: '2026-07-23T12:05:00.000Z',
    },
    historyEntry: {
      fromStatus: 'NEW',
      toStatus: 'UNDER_REVIEW',
      comment: null,
      changedAt: '2026-07-23T12:05:00.000Z',
      changedBy: { id: assigneeId, displayName: 'Staff member' },
    },
  }));
  const updateAssignment = jest.fn(async () => ({
    incident: {
      id: incidentId,
      internalCaseId: 'GAR-20260723-0001',
      assignedTo: {
        id: assigneeId,
        displayName: 'Staff member',
        role: StaffRole.MODERATOR,
      },
      updatedAt: '2026-07-23T12:05:00.000Z',
    },
  }));
  const eligibleAssignees = jest.fn(async () => ({
    users: [
      {
        id: assigneeId,
        displayName: 'Staff member',
        email: 'staff@example.test',
        role: StaffRole.MODERATOR,
      },
    ],
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(IncidentWorkflowService)
      .useValue({ updateStatus, updateAssignment, eligibleAssignees })
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
  });

  afterAll(async () => app.close());

  function patch(path: string, body: object) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send(body);
  }

  it('blocks unauthenticated mutations and untrusted origins', async () => {
    await patch(`/api/admin/incidents/${incidentId}/status`, {
      toStatus: 'UNDER_REVIEW',
      expectedUpdatedAt,
    }).expect(401);

    principal = principalFor(StaffRole.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/admin/incidents/${incidentId}/status`)
      .set('Cookie', cookie)
      .set('Origin', 'https://untrusted.example')
      .set('Content-Type', 'application/json')
      .send({ toStatus: 'UNDER_REVIEW', expectedUpdatedAt })
      .expect(403);
  });

  it.each([StaffRole.EDITOR, StaffRole.ANALYST])('blocks %s status mutations', async (role) => {
    principal = principalFor(role);
    await patch(`/api/admin/incidents/${incidentId}/status`, {
      toStatus: 'UNDER_REVIEW',
      expectedUpdatedAt,
    }).expect(403);
  });

  it.each([StaffRole.MODERATOR, StaffRole.ADMIN, StaffRole.SUPER_ADMIN])(
    'allows %s status mutations',
    async (role) => {
      principal = principalFor(role);
      const response = await patch(`/api/admin/incidents/${incidentId}/status`, {
        toStatus: 'UNDER_REVIEW',
        expectedUpdatedAt,
      }).expect(200);
      expect(response.text).not.toMatch(/contact|password|session|token/i);
      expect(updateStatus).toHaveBeenCalledWith(
        incidentId,
        { toStatus: 'UNDER_REVIEW', expectedUpdatedAt },
        principal,
      );
    },
  );

  it('allows assignment only to ADMIN and SUPER_ADMIN', async () => {
    principal = principalFor(StaffRole.MODERATOR);
    await patch(`/api/admin/incidents/${incidentId}/assignment`, {
      assignedToUserId: assigneeId,
      expectedUpdatedAt,
    }).expect(403);

    for (const role of [StaffRole.ADMIN, StaffRole.SUPER_ADMIN]) {
      principal = principalFor(role);
      await patch(`/api/admin/incidents/${incidentId}/assignment`, {
        assignedToUserId: assigneeId,
        expectedUpdatedAt,
      }).expect(200);
    }
  });

  it('validates UUIDs and strict bodies, and preserves safe conflict status', async () => {
    principal = principalFor(StaffRole.ADMIN);
    await patch('/api/admin/incidents/not-a-uuid/status', {
      toStatus: 'UNDER_REVIEW',
      expectedUpdatedAt,
    }).expect(400);
    await patch(`/api/admin/incidents/${incidentId}/status`, {
      toStatus: 'UNKNOWN',
      expectedUpdatedAt,
    }).expect(400);
    await patch(`/api/admin/incidents/${incidentId}/status`, {
      toStatus: 'UNDER_REVIEW',
      expectedUpdatedAt,
      unexpected: true,
    }).expect(400);

    updateStatus.mockRejectedValueOnce(
      new ConflictException('The incident changed and must be refreshed.') as never,
    );
    const response = await patch(`/api/admin/incidents/${incidentId}/status`, {
      toStatus: 'UNDER_REVIEW',
      expectedUpdatedAt,
    }).expect(409);
    expect(response.text).not.toMatch(/prisma|sql|contact|session/i);
  });

  it('restricts the eligible-assignee directory to administrators', async () => {
    principal = principalFor(StaffRole.MODERATOR);
    await request(app.getHttpServer())
      .get('/api/admin/incidents/eligible-assignees')
      .set('Cookie', cookie)
      .expect(403);

    principal = principalFor(StaffRole.ADMIN);
    const response = await request(app.getHttpServer())
      .get('/api/admin/incidents/eligible-assignees')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual({
      users: [
        {
          id: assigneeId,
          displayName: 'Staff member',
          email: 'staff@example.test',
          role: 'MODERATOR',
        },
      ],
    });
  });
});
