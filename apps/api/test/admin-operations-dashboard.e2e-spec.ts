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
import { AdminOperationsDashboardService } from '../src/modules/dashboard/admin-operations-dashboard.service.js';

const actorId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const cookie = 'garkuwa_staff_session=fake-token';

describe('admin operations dashboard HTTP endpoint', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const operations = jest.fn(async (query: { range: string }) => ({
    generatedAt: '2026-07-24T08:00:00.000Z',
    range: {
      key: query.range,
      from: '2026-06-25T00:00:00.000Z',
      to: '2026-07-24T08:00:00.000Z',
    },
    overview: {
      totalIncidents: 0,
      newIncidents: 0,
      underReviewIncidents: 0,
      unassignedIncidents: 0,
      openIncidents: 0,
      closedIncidents: 0,
      rejectedIncidents: 0,
    },
    statusDistribution: [],
    severityDistribution: [],
    submissionTrend: [],
    assignmentWorkload: [],
    attachmentReviewWorkload: {
      quarantined: 0,
      available: 0,
      rejected: 0,
    },
    recentActivity: [],
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(AdminOperationsDashboardService)
      .useValue({ operations })
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
  });

  afterAll(async () => app.close());

  function authenticateAs(role: StaffRole) {
    principal = {
      id: actorId,
      email: 'staff@example.test',
      name: 'Staff',
      role,
    };
  }

  const get = (query = '') =>
    request(app.getHttpServer())
      .get(`/api/admin/dashboard/operations${query}`)
      .set('Cookie', cookie);

  it('blocks unauthenticated and EDITOR requests', async () => {
    await get().expect(401);
    authenticateAs(StaffRole.EDITOR);
    await get().expect(403);
  });

  it.each([StaffRole.MODERATOR, StaffRole.ANALYST, StaffRole.ADMIN, StaffRole.SUPER_ADMIN])(
    'allows %s with private no-store responses',
    async (role) => {
      authenticateAs(role);
      const response = await get('?range=7d').expect(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(operations).toHaveBeenCalledWith({ range: '7d' });
      expect(response.text).not.toMatch(
        /description|coordinates|contact|noteBody|filename|objectKey|sha256|password|session|reason/i,
      );
    },
  );

  it('defaults to 30d and rejects unsupported or unknown query fields', async () => {
    authenticateAs(StaffRole.ADMIN);
    await get().expect(200);
    expect(operations).toHaveBeenLastCalledWith({ range: '30d' });
    await get('?range=365d').expect(400);
    await get('?range=30d&unknown=true').expect(400);
  });

  it('does not affect the public health endpoint', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
