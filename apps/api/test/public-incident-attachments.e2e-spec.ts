import { ValidationPipe } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApiHttpHardening } from '../src/config/http-hardening.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { INCIDENT_OBJECT_STORAGE } from '../src/modules/incidents/attachments/incident-object-storage.js';
import { PublicIncidentAbuseGuard } from '../src/modules/incidents/public-incident-abuse.guard.js';

const categoryId = '6bd8a2d5-d369-49f6-bf37-27a35a983a7d';
const incidentId = '09980491-d3a6-4f0b-a2f4-e97458ee4973';
const report = {
  categoryId,
  description: 'A sufficiently detailed attachment incident report.',
  severity: 'MEDIUM',
  submissionLanguage: 'ha',
};
const png = (() => {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(2, 16);
  buffer.writeUInt32BE(3, 20);
  return buffer;
})();

describe('public incident multipart submission', () => {
  let app: NestExpressApplication;
  const putObject = jest.fn(async () => undefined);
  const deleteObject = jest.fn(async () => undefined);
  const transaction = {
    incidentCategory: { findFirst: jest.fn(async () => ({ id: categoryId })) },
    incident: { create: jest.fn(async () => ({ id: incidentId })) },
    incidentContact: { create: jest.fn(async () => ({ id: 'contact-id' })) },
    incidentStatusHistory: { create: jest.fn(async () => ({ id: 'history-id' })) },
    incidentAttachment: { createMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof transaction) => Promise<void>) =>
      work(transaction),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(INCIDENT_OBJECT_STORAGE)
      .useValue({ putObject, deleteObject, getObject: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApiHttpHardening(app);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    app.get(PublicIncidentAbuseGuard).reset();
  });
  afterAll(async () => app.close());

  it('accepts a bounded verified file and exposes no attachment internals', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/incidents/with-attachments')
      .field('report', JSON.stringify(report))
      .attach('attachments', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(201);
    expect(response.body).toEqual({ success: true, message: expect.any(String) });
    expect(response.text).not.toMatch(/objectKey|sha256|QUARANTINED|incidentId/);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(transaction.incidentAttachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          incidentId,
          originalFilename: 'proof.png',
          verifiedMimeType: 'image/png',
          width: 2,
          height: 3,
        }),
      ],
    });
  });

  it('rejects malformed report JSON, unexpected fields and invalid files without storage', async () => {
    await request(app.getHttpServer())
      .post('/api/public/incidents/with-attachments')
      .field('report', '{bad')
      .attach('attachments', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/public/incidents/with-attachments')
      .field('report', JSON.stringify({ ...report, unknown: true }))
      .attach('attachments', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(400);
    expect(putObject).not.toHaveBeenCalled();
  });

  it('cleans stored objects when the database transaction fails', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('database failure'));
    await request(app.getHttpServer())
      .post('/api/public/incidents/with-attachments')
      .field(
        'report',
        JSON.stringify({ ...report, description: 'Database failure compensation test report.' }),
      )
      .attach('attachments', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(500);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });
});
