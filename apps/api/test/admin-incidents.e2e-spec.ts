import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { StaffRole } from '../src/generated/prisma/enums.js';
import { AdminIncidentsService } from '../src/modules/incidents/admin/admin-incidents.service.js';
import type { StaffPrincipal } from '../src/modules/auth/auth.types.js';
import { StaffSessionService } from '../src/modules/auth/staff-session.service.js';

const incidentId = '52fc7e20-ab06-4f7c-8d3c-15f075275fd3';
const cookie = 'garkuwa_staff_session=fake-opaque-token';
const queueResponse = {
  items: [
    {
      id: incidentId,
      internalCaseId: 'GAR-20260722-0001',
      category: {
        id: 'a35b3b89-1d0f-4a20-bbcf-c91f438641c0',
        nameHa: 'Tsaro',
        nameEn: 'Safety',
      },
      status: 'NEW',
      severity: 'MEDIUM',
      submissionLanguage: 'ha',
      state: 'Kano',
      lga: null,
      locationDescription: null,
      incidentDate: null,
      submittedAt: '2026-07-22T12:00:00.000Z',
      assignedTo: null,
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};
const detailResponse = {
  incident: {
    ...queueResponse.items[0],
    description: 'Fake report text.',
    incidentTime: null,
    latitude: null,
    longitude: null,
    duplicateOfIncidentId: null,
    updatedAt: '2026-07-22T12:00:00.000Z',
    closedAt: null,
    statusHistory: [],
    assignmentHistory: [],
  },
};

describe('admin incident HTTP endpoints', () => {
  let app: NestExpressApplication;
  let principal: StaffPrincipal | null = null;
  const authenticate = jest.fn(async () => principal);
  const list = jest.fn(async () => queueResponse);
  const detail = jest.fn(async () => detailResponse);
  const findManyCategories = jest.fn(async () => []);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ incidentCategory: { findMany: findManyCategories } })
      .overrideProvider(StaffSessionService)
      .useValue({ authenticate, revoke: jest.fn() })
      .overrideProvider(AdminIncidentsService)
      .useValue({ list, detail })
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

  it('returns 401 for unauthenticated queue and detail requests', async () => {
    await request(app.getHttpServer()).get('/api/admin/incidents').expect(401);
    await request(app.getHttpServer()).get(`/api/admin/incidents/${incidentId}`).expect(401);
  });

  it('returns 403 for EDITOR', async () => {
    principal = {
      id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
      email: 'editor@example.test',
      name: 'Editor',
      role: StaffRole.EDITOR,
    };
    await request(app.getHttpServer())
      .get('/api/admin/incidents')
      .set('Cookie', cookie)
      .expect(403);
  });

  it.each([StaffRole.MODERATOR, StaffRole.ADMIN, StaffRole.SUPER_ADMIN, StaffRole.ANALYST])(
    'allows %s and returns only the safe queue shape',
    async (role) => {
      principal = {
        id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
        email: 'viewer@example.test',
        name: 'Viewer',
        role,
      };
      const response = await request(app.getHttpServer())
        .get('/api/admin/incidents?page=1&pageSize=20&status=NEW')
        .set('Cookie', cookie)
        .expect(200);
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20, status: 'NEW', sort: 'newest' }),
      );
      expect(response.body).toEqual(queueResponse);
      expect(response.body.items[0]).not.toHaveProperty('description');
      expect(response.text).not.toMatch(/contact|password|token/i);
    },
  );

  it('returns safe detail and validates the UUID parameter', async () => {
    principal = {
      id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
      email: 'moderator@example.test',
      name: 'Moderator',
      role: StaffRole.MODERATOR,
    };
    const response = await request(app.getHttpServer())
      .get(`/api/admin/incidents/${incidentId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual(detailResponse);
    expect(response.text).not.toMatch(/contact|passwordHash|tokenHash/i);
    await request(app.getHttpServer())
      .get('/api/admin/incidents/not-a-uuid')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('leaves public incident routes unauthenticated', async () => {
    await request(app.getHttpServer()).get('/api/public/incident-categories').expect(200);
    await request(app.getHttpServer()).post('/api/public/incidents').send({}).expect(400);
  });
});
