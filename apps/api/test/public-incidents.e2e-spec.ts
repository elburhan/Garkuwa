import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PublicIncidentAbuseGuard } from '../src/modules/incidents/public-incident-abuse.guard.js';

const categoryId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const incidentId = '09980491-d3a6-4f0b-a2f4-e97458ee4973';
const minimalSubmission = {
  categoryId,
  description: 'A sufficiently detailed incident description.',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
};

describe('Public incident submission endpoint', () => {
  let app: NestExpressApplication;
  let abuseGuard: PublicIncidentAbuseGuard;
  const transaction = {
    incidentCategory: {
      findFirst: jest.fn<() => Promise<{ id: string } | null>>(),
    },
    incident: { create: jest.fn<() => Promise<{ id: string }>>() },
    incidentContact: { create: jest.fn<() => Promise<{ id: string }>>() },
    incidentStatusHistory: { create: jest.fn<() => Promise<{ id: string }>>() },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (value: typeof transaction) => Promise<void>) =>
      work(transaction),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.init();
    abuseGuard = app.get(PublicIncidentAbuseGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    abuseGuard.reset();
    transaction.incidentCategory.findFirst.mockResolvedValue({ id: categoryId });
    transaction.incident.create.mockResolvedValue({ id: incidentId });
    transaction.incidentContact.create.mockResolvedValue({ id: 'contact-id' });
    transaction.incidentStatusHistory.create.mockResolvedValue({ id: 'history-id' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a minimal anonymous report without authentication or contact details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send(minimalSubmission)
      .expect(201);

    expect(response.body).toEqual({ success: true, message: expect.any(String) });
    expect(transaction.incidentContact.create).not.toHaveBeenCalled();
    expect(response.body).not.toEqual(
      expect.objectContaining({
        id: expect.anything(),
        internalCaseId: expect.anything(),
        status: expect.anything(),
        contact: expect.anything(),
        trackingUrl: expect.anything(),
      }),
    );
  });

  it('accepts valid optional contact details in the same transaction', async () => {
    await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send({
        ...minimalSubmission,
        submissionLanguage: 'en',
        contact: {
          email: 'reporter@example.test',
          preferredContactMethod: 'EMAIL',
          consentToContact: true,
        },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, message: expect.any(String) });
      });

    expect(transaction.incidentContact.create).toHaveBeenCalledTimes(1);
    expect(transaction.incidentContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: expect.stringMatching(/^v1:/) }),
    });
  });

  it('returns 400 for invalid contact details', async () => {
    await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send({
        ...minimalSubmission,
        contact: {
          email: 'not-an-email',
          preferredContactMethod: 'EMAIL',
          consentToContact: true,
        },
      })
      .expect(400);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a safe 400 response for an unavailable category', async () => {
    transaction.incidentCategory.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send(minimalSubmission)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: 'The selected incident category is unavailable.',
    });
    expect(response.text).not.toContain(categoryId);
  });

  it('returns 429 for the sixth submission from one client inside the window', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await request(app.getHttpServer())
        .post('/api/public/incidents')
        .send({
          ...minimalSubmission,
          description: `A sufficiently detailed incident description number ${index}.`,
        })
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send({
        ...minimalSubmission,
        description: 'A sufficiently detailed sixth incident description.',
      })
      .expect(429);

    expect(response.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many incident submissions. Please try again later.',
    });
    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('internalCaseId');
    expect(response.body).not.toHaveProperty('contact');
  });

  it('rejects an identical recent submission without storing plaintext in limiter state', async () => {
    await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send(minimalSubmission)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send(minimalSubmission)
      .expect(429);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('requires application/json for incident submissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/incidents')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(minimalSubmission))
      .expect(415);

    expect(response.body).toMatchObject({
      statusCode: 415,
      message: 'Content-Type must be application/json.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects JSON bodies larger than 100kb safely', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/incidents')
      .send({ ...minimalSubmission, description: 'x'.repeat(101 * 1024) })
      .expect(413);

    expect(response.body).not.toHaveProperty('internalCaseId');
    expect(response.body).not.toHaveProperty('contact');
    expect(response.body).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'The JSON request body exceeds the 100kb limit.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not apply the incident submission limit to the health endpoint', async () => {
    for (let index = 0; index < 7; index += 1) {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    }
  });
});
