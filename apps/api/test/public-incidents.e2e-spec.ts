import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const categoryId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const incidentId = '09980491-d3a6-4f0b-a2f4-e97458ee4973';
const minimalSubmission = {
  categoryId,
  description: 'A sufficiently detailed incident description.',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
};

describe('Public incident submission endpoint', () => {
  let app: INestApplication;
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

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
});
